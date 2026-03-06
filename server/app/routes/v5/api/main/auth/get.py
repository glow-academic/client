"""Auth GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_auth_permissions_context — fail-fast 404/403
  3. resolve_auth_context — artifact + draft → merged + hydrated resources
  4. score_tools — tool graph + artifact resources → per-resource tool picks
  5. Pure Python — permissions, show/required flags, response assembly
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from redis.asyncio import Redis

from app.infra.auth_context import resolve_auth_context
from app.infra.auth_permissions_context import resolve_auth_permissions_context
from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_redis_client
from app.infra.helpers import dedupe_by_id
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.auth.permissions import (
    AUTH_BASIC_RESOURCES,
    AUTH_RESOURCES,
    compute_can_edit,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_protocols_required,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_protocols,
    compute_show_slugs,
    compute_slugs_required,
)
from app.routes.v5.api.main.auth.types import (
    AuthDescriptionSection,
    AuthFlagConfig,
    AuthFlagSection,
    AuthItemResource,
    AuthItemSection,
    AuthNameSection,
    AuthProtocolSection,
    AuthSlugSection,
    GetAuthApiRequest,
    GetAuthApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


# ---------------------------------------------------------------------------
# get_auth_client — composable infra architecture
# ---------------------------------------------------------------------------


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'auth_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("auth_", "")
    label = key.replace("_", " ").title()
    return (key, label)


async def get_auth_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    auth_id: UUID | None,
    draft_id: UUID | None = None,
    group_id: UUID,
    bypass_cache: bool = False,
) -> GetAuthApiResponse:
    """Auth GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_auth_permissions_context → access check (404, fail fast)
      3. resolve_auth_context(auth_id, draft_id, ...) → hydrated resources
      4. score_tools(tool_graph, AUTH_RESOURCES) → per-resource tool picks
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

    if auth_id is not None:
        perms = await resolve_auth_permissions_context(conn, auth_id)

        if not perms.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Auth {auth_id} not found",
            )

    # ── Step 3: Auth artifact context ─────────────────────────────────────

    auth_ctx = await resolve_auth_context(
        conn,
        redis,
        auth_id=auth_id,
        group_id=group_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # ── Step 4: Tool scoring ─────────────────────────────────────────────

    scores = score_tools(common.tool_graph, AUTH_RESOURCES)

    agent_ids: dict[str, UUID | None] = {
        r: (scores.best[r].agent_id if scores.best.get(r) else None)
        for r in AUTH_RESOURCES
    }

    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in AUTH_RESOURCES
    }

    # ── Step 5: Permissions ──────────────────────────────────────────────

    can_edit = compute_can_edit(user_role=profile.role)
    disabled_reason = compute_disabled_reason(user_role=profile.role)

    # ── Step 6: Show / Required / AI flags ───────────────────────────────

    names_has_tools = scores.has_any.get("names", False)
    protocols_has_tools = scores.has_any.get("protocols", False)
    slugs_has_tools = scores.has_any.get("slugs", False)

    all_protocols = dedupe_by_id(
        auth_ctx.resources["protocols"].selected
        + auth_ctx.resources["protocols"].suggestions
    )
    all_slugs = dedupe_by_id(
        auth_ctx.resources["slugs"].selected + auth_ctx.resources["slugs"].suggestions
    )

    show_flags_map = {
        "names": compute_show_name(names_has_tools),
        "descriptions": compute_show_description(),
        "flags": compute_show_flag(),
        "protocols": compute_show_protocols(protocols_has_tools, len(all_protocols)),
        "slugs": compute_show_slugs(slugs_has_tools, len(all_slugs)),
        "items": True,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "protocols": compute_protocols_required(show_flags_map["protocols"]),
        "slugs": compute_slugs_required(show_flags_map["slugs"]),
        "items": False,
    }

    def compute_show_ai_generate(resource: str) -> bool:
        return agent_ids.get(resource) is not None

    show_ai_generate_map = {r: compute_show_ai_generate(r) for r in AUTH_RESOURCES}

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in AUTH_BASIC_RESOURCES
    )

    # ── Step 7: Response assembly ────────────────────────────────────────

    # Flags — enriched format
    all_flags = dedupe_by_id(
        auth_ctx.resources["flags"].selected + auth_ctx.resources["flags"].suggestions
    )
    auth_flags = [
        AuthFlagConfig(
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
        AuthFlagConfig(
            key=derive_flag_key_and_label(f.name)[0],
            label=derive_flag_key_and_label(f.name)[1],
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            show=show_flags_map.get("flags", True),
            required=required_flags_map.get("flags", False),
            generated=f.generated,
        )
        for f in auth_ctx.resources["flags"].selected
        if f.id
    ]

    # Names, Descriptions — all = selected + suggestions deduped
    all_names = dedupe_by_id(
        auth_ctx.resources["names"].selected + auth_ctx.resources["names"].suggestions
    )
    all_descriptions = dedupe_by_id(
        auth_ctx.resources["descriptions"].selected
        + auth_ctx.resources["descriptions"].suggestions
    )

    # Suggestions maps (IDs only)
    suggestions_map = {
        "names": [n.id for n in auth_ctx.resources["names"].suggestions],
        "descriptions": [d.id for d in auth_ctx.resources["descriptions"].suggestions],
        "protocols": [p.id for p in auth_ctx.resources["protocols"].suggestions],
        "slugs": [s.id for s in auth_ctx.resources["slugs"].suggestions],
        "items": [],
    }

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key, []),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    # Items — convert raw item resources to AuthItemResource format
    items_as_resources: list[AuthItemResource] = [
        AuthItemResource(
            auth_item_id=item.id,
            name=item.name,
            description=item.description,
            position=item.position,
            active=True,
            value_masked=None,
            key_id=None,
            encrypted=item.encrypted,
            generated=item.generated,
        )
        for item in auth_ctx.resources["items"].selected
    ]

    return GetAuthApiResponse(
        actor_name=profile.name,
        auth_exists=auth_ctx.artifact_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=auth_ctx.draft_version,
        group_id=group_id,
        basic_show_ai_generate=basic_show_ai_generate,
        names=AuthNameSection(
            **_section("names"),
            resource=auth_ctx.resources["names"].selected[0]
            if auth_ctx.resources["names"].selected
            else None,
            resources=all_names,
        ),
        descriptions=AuthDescriptionSection(
            **_section("descriptions"),
            resource=auth_ctx.resources["descriptions"].selected[0]
            if auth_ctx.resources["descriptions"].selected
            else None,
            resources=all_descriptions,
        ),
        flags=AuthFlagSection(
            **_section("flags"),
            current=current_flags or None,
            resources=auth_flags,
        ),
        protocols=AuthProtocolSection(
            **_section("protocols"),
            current=auth_ctx.resources["protocols"].selected or None,
            resources=all_protocols,
        ),
        slugs=AuthSlugSection(
            **_section("slugs"),
            current=auth_ctx.resources["slugs"].selected or None,
            resources=all_slugs,
        ),
        items=AuthItemSection(
            **_section("items"),
            current=items_as_resources or None,
            resources=items_as_resources,
        ),
    )


# ---------------------------------------------------------------------------
# get_auth_websocket — stub (to be rewritten with infra functions)
# ---------------------------------------------------------------------------


async def get_auth_websocket(*args, **kwargs):
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_auth_websocket needs to be rewritten with infra functions"
    )


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=GetAuthApiResponse)
async def get_auth(
    request: GetAuthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthApiResponse:
    """Get auth information using composable infra architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await get_auth_client(
            conn,
            redis,
            profile_id=profile_id,
            auth_id=request.auth_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "auths"
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
            operation="get_auth",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
