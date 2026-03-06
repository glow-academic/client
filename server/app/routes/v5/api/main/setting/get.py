"""Setting GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_setting_permissions_context — access check (404, 403, fail fast)
  3. resolve_setting_context — artifact + draft -> merged + hydrated resources
  4. score_tools — tool graph + artifact resources -> per-resource tool picks
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
from app.infra.setting_context import resolve_setting_context
from app.infra.setting_permissions_context import resolve_setting_permissions_context
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.setting.permissions import (
    SETTING_RESOURCES,
    compute_auth_item_keys_required,
    compute_auths_required,
    compute_can_edit,
    compute_colors_required,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_profiles_required,
    compute_provider_keys_required,
    compute_show_ai_generate,
    compute_show_auth_item_keys,
    compute_show_auths,
    compute_show_colors,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_profiles,
    compute_show_provider_keys,
    compute_show_systems,
    compute_systems_required,
    derive_flag_key_and_label,
    has_access,
)
from app.routes.v5.api.main.setting.types import (
    GetSettingApiRequest,
    GetSettingApiResponse,
    SettingAuthItemKeySection,
    SettingAuthSection,
    SettingColorSection,
    SettingDepartmentSection,
    SettingDescriptionSection,
    SettingFlagConfig,
    SettingFlagSection,
    SettingNameSection,
    SettingProfileSection,
    SettingProviderKeySection,
    SettingSystemSection,
)
from app.utils.error.handle_route_error import handle_route_error

# Setting-specific flag names (business logic)
SETTING_FLAG_NAMES = {"setting_active"}

router = APIRouter()


# ---------------------------------------------------------------------------
# get_setting_client — composable infra architecture
# ---------------------------------------------------------------------------


async def get_setting_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    setting_id: UUID | None,
    draft_id: UUID | None = None,
    group_id: UUID,
    # Search filters (threaded from client)
    color_search: str | None = None,
    bypass_cache: bool = False,
) -> GetSettingApiResponse:
    """Setting GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) -> profile, tool_graph, runs
      2. resolve_setting_permissions_context -> access check (404, 403, fail fast)
      3. resolve_setting_context(setting_id, draft_id, ...) -> hydrated resources
      4. score_tools(tool_graph, SETTING_RESOURCES) -> per-resource tool picks
      5. Pure Python: permissions, show/required/AI flags, response assembly
    """

    # -- Step 1: Common context (profile -> tool_graph + runs) ----------------

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

    # -- Step 2: Permissions check (fail fast before full hydration) -----------

    perms = None
    if setting_id is not None:
        perms = await resolve_setting_permissions_context(conn, setting_id)

        if not perms.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Setting {setting_id} not found",
            )

        if not has_access(profile.role, profile.department_ids, perms.department_ids):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this setting. It may be restricted to other departments.",
            )

    # -- Step 3: Setting artifact context -------------------------------------

    setting = await resolve_setting_context(
        conn,
        redis,
        setting_id=setting_id,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=profile.department_ids,
        color_search=color_search,
        bypass_cache=bypass_cache,
    )

    # -- Step 4: Tool scoring -------------------------------------------------

    scores = score_tools(common.tool_graph, SETTING_RESOURCES)

    agent_ids: dict[str, UUID | None] = {
        r: (scores.best[r].agent_id if scores.best.get(r) else None)
        for r in SETTING_RESOURCES
    }

    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in SETTING_RESOURCES
    }

    # -- Step 5: Permissions --------------------------------------------------

    perms_department_ids = perms.department_ids if perms else []

    can_edit = compute_can_edit(
        user_role=profile.role,
        setting_department_ids=perms_department_ids,
        user_department_ids=profile.department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=profile.role,
        setting_department_ids=perms_department_ids,
        user_department_ids=profile.department_ids,
    )

    # -- Step 6: Show / Required / AI flags -----------------------------------

    all_colors = dedupe_by_id(
        setting.resources["colors"].selected + setting.resources["colors"].suggestions
    )
    all_departments = dedupe_by_id(
        setting.resources["departments"].selected
        + setting.resources["departments"].suggestions
    )

    show_flags_map = {
        "names": compute_show_name(),
        "descriptions": compute_show_description(),
        "colors": compute_show_colors(len(all_colors)),
        "flags": compute_show_flag(),
        "departments": compute_show_departments(len(all_departments)),
        "profiles": compute_show_profiles(),
        "auths": compute_show_auths(),
        "provider_keys": compute_show_provider_keys(),
        "auth_item_keys": compute_show_auth_item_keys(),
        "systems": compute_show_systems(),
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "colors": compute_colors_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(show_flags_map["departments"]),
        "profiles": compute_profiles_required(),
        "auths": compute_auths_required(),
        "provider_keys": compute_provider_keys_required(),
        "auth_item_keys": compute_auth_item_keys_required(),
        "systems": compute_systems_required(),
    }

    show_ai_generate_map = {
        r: compute_show_ai_generate(agent_ids, r) for r in SETTING_RESOURCES
    }

    # -- Step 7: Response assembly --------------------------------------------

    # Build flags with enriched config
    all_flags = dedupe_by_id(
        setting.resources["flags"].selected + setting.resources["flags"].suggestions
    )
    setting_flags = [
        SettingFlagConfig(
            key=derive_flag_key_and_label(f.name)[0],
            label=derive_flag_key_and_label(f.name)[1],
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            generated=f.generated,
        )
        for f in all_flags
        if f.id
    ]

    current_flag = None
    if setting.resources["flags"].selected:
        f = setting.resources["flags"].selected[0]
        current_flag = SettingFlagConfig(
            key=derive_flag_key_and_label(f.name)[0],
            label=derive_flag_key_and_label(f.name)[1],
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            generated=f.generated,
        )

    suggestions_map: dict[str, list[UUID]] = {
        "names": [n.id for n in setting.resources["names"].suggestions],
        "descriptions": [d.id for d in setting.resources["descriptions"].suggestions],
        "colors": [c.id for c in setting.resources["colors"].suggestions],
        "departments": [d.id for d in setting.resources["departments"].suggestions],
        "profiles": [p.id for p in setting.resources["profiles"].suggestions],
        "auths": [a.id for a in setting.resources["auths"].suggestions],
        "provider_keys": [pk.id for pk in setting.resources["provider_keys"].suggestions],
        "auth_item_keys": [
            aik.id for aik in setting.resources["auth_item_keys"].suggestions
        ],
        "systems": [s.id for s in setting.resources["systems"].suggestions],
    }

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    all_names = dedupe_by_id(
        setting.resources["names"].selected + setting.resources["names"].suggestions
    )
    all_descriptions = dedupe_by_id(
        setting.resources["descriptions"].selected
        + setting.resources["descriptions"].suggestions
    )
    all_profiles = dedupe_by_id(
        setting.resources["profiles"].selected
        + setting.resources["profiles"].suggestions
    )
    all_auths = dedupe_by_id(
        setting.resources["auths"].selected + setting.resources["auths"].suggestions
    )
    all_provider_keys = dedupe_by_id(
        setting.resources["provider_keys"].selected
        + setting.resources["provider_keys"].suggestions
    )
    all_auth_item_keys = dedupe_by_id(
        setting.resources["auth_item_keys"].selected
        + setting.resources["auth_item_keys"].suggestions
    )
    all_systems = dedupe_by_id(
        setting.resources["systems"].selected
        + setting.resources["systems"].suggestions
    )

    return GetSettingApiResponse(
        # Context
        actor_name=profile.name,
        setting_exists=setting.artifact_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=setting.draft_version,
        group_id=group_id,
        # Per-resource sections
        names=SettingNameSection(
            **_section("names"),
            resource=setting.resources["names"].selected[0]
            if setting.resources["names"].selected
            else None,
            resources=all_names,
        ),
        descriptions=SettingDescriptionSection(
            **_section("descriptions"),
            resource=setting.resources["descriptions"].selected[0]
            if setting.resources["descriptions"].selected
            else None,
            resources=all_descriptions,
        ),
        colors=SettingColorSection(
            **_section("colors"),
            current=setting.resources["colors"].selected,
            resources=all_colors,
        ),
        flags=SettingFlagSection(
            **_section("flags"),
            current=current_flag,
            resources=setting_flags,
        ),
        departments=SettingDepartmentSection(
            **_section("departments"),
            current=setting.resources["departments"].selected,
            resources=all_departments,
        ),
        profiles=SettingProfileSection(
            **_section("profiles"),
            current=setting.resources["profiles"].selected,
            resources=all_profiles,
        ),
        auths=SettingAuthSection(
            **_section("auths"),
            current=setting.resources["auths"].selected,
            resources=all_auths,
        ),
        provider_keys=SettingProviderKeySection(
            **_section("provider_keys"),
            current=setting.resources["provider_keys"].selected,
            resources=all_provider_keys,
        ),
        auth_item_keys=SettingAuthItemKeySection(
            **_section("auth_item_keys"),
            current=setting.resources["auth_item_keys"].selected,
            resources=all_auth_item_keys,
        ),
        systems=SettingSystemSection(
            **_section("systems"),
            current=setting.resources["systems"].selected,
            resources=all_systems,
        ),
    )


# ---------------------------------------------------------------------------
# get_setting_websocket — stub (to be rewritten with infra functions)
# ---------------------------------------------------------------------------


async def get_setting_websocket(*args, **kwargs):
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_setting_websocket needs to be rewritten with infra functions"
    )


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=GetSettingApiResponse)
async def get_setting(
    request: GetSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSettingApiResponse:
    """Get setting information using composable infra architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        redis = get_redis_client()

        response_data = await get_setting_client(
            conn,
            redis,
            profile_id=profile_id,
            setting_id=request.setting_id,
            draft_id=request.draft_id,
            group_id=request.group_id,
            color_search=request.color_search,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "settings"
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
            operation="get_setting",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
