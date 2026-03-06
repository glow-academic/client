"""Provider GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_provider_permissions_context — fail-fast 404/403
  3. resolve_provider_context — artifact + draft → merged + hydrated resources
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
from app.infra.globals import get_db, get_redis_client
from app.infra.helpers import dedupe_by_id
from app.infra.provider_context import resolve_provider_context
from app.infra.provider_permissions_context import (
    resolve_provider_permissions_context,
)
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.provider.permissions import (
    PROVIDER_BASIC_RESOURCES,
    PROVIDER_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_endpoint_required,
    compute_flag_required,
    compute_key_required,
    compute_name_required,
    compute_show_departments,
    compute_show_description,
    compute_show_endpoint,
    compute_show_flag,
    compute_show_key,
    compute_show_name,
    compute_show_value,
    compute_value_required,
    has_access,
)
from app.routes.v5.api.main.provider.types import (
    GetProviderApiRequest,
    GetProviderApiResponse,
    ProviderDepartmentSection,
    ProviderDescriptionSection,
    ProviderEndpointSection,
    ProviderFlagConfig,
    ProviderFlagSection,
    ProviderKeySection,
    ProviderNameSection,
    ProviderValueSection,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

PROVIDER_INTEGRATIONS_RESOURCES: set[str] = {"values", "endpoints"}


# ---------------------------------------------------------------------------
# get_provider_client — composable infra architecture
# ---------------------------------------------------------------------------


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'provider_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("provider_", "")
    label = key.replace("_", " ").title()
    return (key, label)


async def get_provider_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    provider_id: UUID | None,
    draft_id: UUID | None = None,
    group_id: UUID,
    bypass_cache: bool = False,
) -> GetProviderApiResponse:
    """Provider GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_provider_permissions_context → access check (404, 403, fail fast)
      3. resolve_provider_context(provider_id, draft_id, ...) → hydrated resources
      4. score_tools(tool_graph, PROVIDER_RESOURCES) → per-resource tool picks
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
    if provider_id is not None:
        perms = await resolve_provider_permissions_context(conn, provider_id)

        if not perms.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Provider {provider_id} not found",
            )

        if not has_access(profile.role, profile.department_ids, perms.department_ids):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this provider. It may be restricted to other departments.",
            )

    # ── Step 3: Provider artifact context ─────────────────────────────────

    prov_ctx = await resolve_provider_context(
        conn,
        redis,
        provider_id=provider_id,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=profile.department_ids,
        bypass_cache=bypass_cache,
    )

    # ── Step 4: Tool scoring ─────────────────────────────────────────────

    scores = score_tools(common.tool_graph, PROVIDER_RESOURCES)

    agent_ids: dict[str, UUID | None] = {
        r: (scores.best[r].agent_id if scores.best.get(r) else None)
        for r in PROVIDER_RESOURCES
    }

    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in PROVIDER_RESOURCES
    }

    # ── Step 5: Permissions ──────────────────────────────────────────────

    perms_department_ids = perms.department_ids if perms else []
    active_model_count = perms.active_model_count if perms else 0

    can_edit = compute_can_edit(
        user_role=profile.role,
        provider_department_ids=perms_department_ids,
        active_model_count=active_model_count,
        user_department_ids=profile.department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=profile.role,
        provider_department_ids=perms_department_ids,
        active_model_count=active_model_count,
    )

    # ── Step 6: Show / Required / AI flags ───────────────────────────────

    names_has_tools = scores.has_any.get("names", False)

    all_departments = dedupe_by_id(
        prov_ctx.resources["departments"].selected
        + prov_ctx.resources["departments"].suggestions
    )

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
        "descriptions": compute_show_description(),
        "flags": compute_show_flag(),
        "departments": compute_show_departments(len(all_departments)),
        "values": compute_show_value(),
        "endpoints": compute_show_endpoint(),
        "keys": compute_show_key(),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "values": compute_value_required(),
        "endpoints": compute_endpoint_required(),
        "keys": compute_key_required(),
    }

    def compute_show_ai_generate(resource: str) -> bool:
        return agent_ids.get(resource) is not None

    show_ai_generate_map = {r: compute_show_ai_generate(r) for r in PROVIDER_RESOURCES}
    # Keys never show AI generate
    show_ai_generate_map["keys"] = False

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in PROVIDER_BASIC_RESOURCES
    )
    integrations_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in PROVIDER_INTEGRATIONS_RESOURCES
    )

    # ── Step 7: Validation ───────────────────────────────────────────────

    if provider_id is None:
        if not all_departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    # ── Step 8: Response assembly ────────────────────────────────────────

    # Flags — enriched format
    all_flags = dedupe_by_id(
        prov_ctx.resources["flags"].selected + prov_ctx.resources["flags"].suggestions
    )
    provider_flags = [
        ProviderFlagConfig(
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
        ProviderFlagConfig(
            key=derive_flag_key_and_label(f.name)[0],
            label=derive_flag_key_and_label(f.name)[1],
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            show=show_flags_map.get("flags", True),
            required=required_flags_map.get("flags", False),
            generated=f.generated,
        )
        for f in prov_ctx.resources["flags"].selected
        if f.id
    ]

    # Names, Descriptions — all = selected + suggestions deduped
    all_names = dedupe_by_id(
        prov_ctx.resources["names"].selected + prov_ctx.resources["names"].suggestions
    )
    all_descriptions = dedupe_by_id(
        prov_ctx.resources["descriptions"].selected
        + prov_ctx.resources["descriptions"].suggestions
    )
    all_values = dedupe_by_id(
        prov_ctx.resources["values"].selected + prov_ctx.resources["values"].suggestions
    )
    all_endpoints = dedupe_by_id(
        prov_ctx.resources["endpoints"].selected
        + prov_ctx.resources["endpoints"].suggestions
    )
    all_keys = dedupe_by_id(
        prov_ctx.resources["keys"].selected + prov_ctx.resources["keys"].suggestions
    )

    # Suggestions maps (IDs only)
    suggestions_map = {
        "names": [n.id for n in prov_ctx.resources["names"].suggestions],
        "descriptions": [d.id for d in prov_ctx.resources["descriptions"].suggestions],
        "departments": [d.id for d in prov_ctx.resources["departments"].suggestions],
        "values": [v.id for v in prov_ctx.resources["values"].suggestions],
        "endpoints": [e.id for e in prov_ctx.resources["endpoints"].suggestions],
        "keys": [k.id for k in prov_ctx.resources["keys"].suggestions],
    }

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key, []),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    return GetProviderApiResponse(
        actor_name=profile.name,
        provider_exists=prov_ctx.artifact_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=prov_ctx.draft_version,
        group_id=group_id,
        basic_show_ai_generate=basic_show_ai_generate,
        integrations_show_ai_generate=integrations_show_ai_generate,
        names=ProviderNameSection(
            **_section("names"),
            resource=prov_ctx.resources["names"].selected[0]
            if prov_ctx.resources["names"].selected
            else None,
            resources=all_names,
        ),
        descriptions=ProviderDescriptionSection(
            **_section("descriptions"),
            resource=prov_ctx.resources["descriptions"].selected[0]
            if prov_ctx.resources["descriptions"].selected
            else None,
            resources=all_descriptions,
        ),
        flags=ProviderFlagSection(
            **_section("flags"),
            current=current_flags or None,
            resources=provider_flags,
        ),
        departments=ProviderDepartmentSection(
            **_section("departments"),
            current=prov_ctx.resources["departments"].selected or None,
            resources=all_departments,
        ),
        values=ProviderValueSection(
            **_section("values"),
            resource=prov_ctx.resources["values"].selected[0]
            if prov_ctx.resources["values"].selected
            else None,
            resources=all_values,
        ),
        endpoints=ProviderEndpointSection(
            **_section("endpoints"),
            resource=prov_ctx.resources["endpoints"].selected[0]
            if prov_ctx.resources["endpoints"].selected
            else None,
            resources=all_endpoints,
        ),
        keys=ProviderKeySection(
            **_section("keys"),
            resource=prov_ctx.resources["keys"].selected[0]
            if prov_ctx.resources["keys"].selected
            else None,
            resources=all_keys,
        ),
    )


# ---------------------------------------------------------------------------
# get_provider_websocket — stub (to be rewritten with infra functions)
# ---------------------------------------------------------------------------


async def get_provider_websocket(*args: object, **kwargs: object) -> None:
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_provider_websocket needs to be rewritten with infra functions"
    )


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=GetProviderApiResponse)
async def get_provider(
    request: GetProviderApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProviderApiResponse:
    """Get provider information using composable infra architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await get_provider_client(
            conn,
            redis,
            profile_id=profile_id,
            provider_id=request.provider_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "providers"
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
            operation="get_provider",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
