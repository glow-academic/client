"""Department GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_department_permissions_context — fail-fast 404/403
  3. resolve_department_context — artifact + draft → merged + hydrated resources
  4. score_tools — tool graph + artifact resources → per-resource tool picks
  5. Pure Python — permissions, show/required flags, response assembly
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from redis.asyncio import Redis

from app.infra.common_context import resolve_common_context
from app.infra.department_context import resolve_department_context
from app.infra.department_permissions_context import (
    resolve_department_permissions_context,
)
from app.infra.globals import get_db, get_redis_client
from app.infra.helpers import dedupe_by_id
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.department.permissions import (
    DEPARTMENT_BASIC_RESOURCES,
    DEPARTMENT_RESOURCES,
    compute_can_edit,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_settings_required,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_settings,
    has_access,
)
from app.routes.v5.api.main.department.types import (
    DepartmentDescriptionSection,
    DepartmentFlagConfig,
    DepartmentFlagSection,
    DepartmentNameSection,
    DepartmentSettingSection,
    GetDepartmentApiRequest,
    GetDepartmentApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


# ---------------------------------------------------------------------------
# derive_flag_key_and_label
# ---------------------------------------------------------------------------


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'department_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("department_", "")
    label = key.replace("_", " ").title()
    return (key, label)


# ---------------------------------------------------------------------------
# get_department_client — composable infra architecture
# ---------------------------------------------------------------------------


async def get_department_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    department_id: UUID | None,
    draft_id: UUID | None = None,
    group_id: UUID,
    bypass_cache: bool = False,
) -> GetDepartmentApiResponse:
    """Department GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_department_permissions_context → access check (404, 403, fail fast)
      3. resolve_department_context(department_id, draft_id, ...) → hydrated resources
      4. score_tools(tool_graph, DEPARTMENT_RESOURCES) → per-resource tool picks
      5. Pure Python: permissions, show/required/AI flags, response assembly
    """

    # ── Step 1: Common context (profile → tool_graph + runs) ──────────────

    common = await resolve_common_context(
        conn,
        redis,
        profile_id=profile_id,
        group_id=group_id,
        bypass_cache=bypass_cache,
    )

    if common is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    profile = common.profile

    # ── Step 2: Permissions check (fail fast before full hydration) ──────

    perms = None
    if department_id is not None:
        perms = await resolve_department_permissions_context(conn, department_id)

        if not perms.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Department {department_id} not found",
            )

        if not has_access(profile.role):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this department.",
            )

    # ── Step 3: Department artifact context ─────────────────────────────────

    dept_ctx = await resolve_department_context(
        conn,
        redis,
        department_id=department_id,
        group_id=group_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # ── Step 4: Tool scoring ─────────────────────────────────────────────

    scores = score_tools(common.tool_graph, DEPARTMENT_RESOURCES)

    agent_ids: dict[str, UUID | None] = {
        r: (scores.best[r].agent_id if scores.best.get(r) else None)
        for r in DEPARTMENT_RESOURCES
    }

    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in DEPARTMENT_RESOURCES
    }

    # ── Step 5: Permissions ──────────────────────────────────────────────

    usage_count = perms.usage_count if perms else 0

    can_edit = compute_can_edit(
        user_role=profile.role,
        usage_count=usage_count,
    )

    disabled_reason = compute_disabled_reason(
        user_role=profile.role,
        usage_count=usage_count,
    )

    # ── Step 6: Show / Required / AI flags ───────────────────────────────

    names_has_tools = scores.has_any.get("names", False)

    all_settings = dedupe_by_id(
        dept_ctx.resources["settings"].selected
        + dept_ctx.resources["settings"].suggestions,
        id_attr="id",
    )

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
        "descriptions": compute_show_description(),
        "flags": compute_show_flag(),
        "settings": compute_show_settings(len(all_settings)),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "settings": compute_settings_required(),
    }

    def compute_show_ai_generate(resource: str) -> bool:
        return agent_ids.get(resource) is not None

    show_ai_generate_map = {
        r: compute_show_ai_generate(r) for r in DEPARTMENT_RESOURCES
    }

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in DEPARTMENT_BASIC_RESOURCES
    )

    # ── Step 7: Response assembly ────────────────────────────────────────

    # Flags — enriched format
    all_flags = dedupe_by_id(
        dept_ctx.resources["flags"].selected + dept_ctx.resources["flags"].suggestions
    )
    department_flags = [
        DepartmentFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flags_map.get("flags", True),
            required=required_flags_map.get("flags", False),
            generated=flag.generated,
        )
        for flag in all_flags
        if flag.id
    ]

    current_flags = [
        DepartmentFlagConfig(
            key=derive_flag_key_and_label(f.name)[0],
            label=derive_flag_key_and_label(f.name)[1],
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            show=show_flags_map.get("flags", True),
            required=required_flags_map.get("flags", False),
            generated=f.generated,
        )
        for f in dept_ctx.resources["flags"].selected
        if f.id
    ]

    # Names, Descriptions — all = selected + suggestions deduped
    all_names = dedupe_by_id(
        dept_ctx.resources["names"].selected + dept_ctx.resources["names"].suggestions
    )
    all_descriptions = dedupe_by_id(
        dept_ctx.resources["descriptions"].selected
        + dept_ctx.resources["descriptions"].suggestions
    )

    # Suggestions maps (IDs only)
    suggestions_map = {
        "names": [n.id for n in dept_ctx.resources["names"].suggestions],
        "descriptions": [d.id for d in dept_ctx.resources["descriptions"].suggestions],
        "settings": [],
    }

    # Detail mode: check access via name resource
    if department_id is not None and not dept_ctx.resources["names"].selected:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this department. It may be restricted to other departments.",
        )

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key, []),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    return GetDepartmentApiResponse(
        actor_name=profile.name,
        department_exists=dept_ctx.artifact_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=dept_ctx.draft_version,
        group_id=group_id,
        basic_show_ai_generate=basic_show_ai_generate,
        names=DepartmentNameSection(
            **_section("names"),
            resource=dept_ctx.resources["names"].selected[0]
            if dept_ctx.resources["names"].selected
            else None,
            resources=all_names,
        ),
        descriptions=DepartmentDescriptionSection(
            **_section("descriptions"),
            resource=dept_ctx.resources["descriptions"].selected[0]
            if dept_ctx.resources["descriptions"].selected
            else None,
            resources=all_descriptions,
        ),
        flags=DepartmentFlagSection(
            **_section("flags"),
            current=current_flags or None,
            resources=department_flags,
        ),
        settings=DepartmentSettingSection(
            **_section("settings"),
            current=dept_ctx.resources["settings"].selected or None,
            resources=all_settings,
        ),
    )


# ---------------------------------------------------------------------------
# get_department_websocket — stub (to be rewritten with infra functions)
# ---------------------------------------------------------------------------


async def get_department_websocket(*args, **kwargs):
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_department_websocket needs to be rewritten with infra functions"
    )


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=GetDepartmentApiResponse)
async def get_department(
    request: GetDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDepartmentApiResponse:
    """Get department information using composable infra architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await get_department_client(
            conn,
            redis,
            profile_id=profile_id,
            department_id=request.department_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "departments"
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_department",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
