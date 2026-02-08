"""Settings get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (settings_id = NULL) and detail (settings_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.setting.permissions import (
    compute_can_edit,
    compute_colors_required,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_show_colors,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    has_access,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetSettingAccessSqlParams,
    GetSettingAccessSqlRow,
    GetSettingApiRequest,
    GetSettingApiResponse,
    GetSettingIdsSqlParams,
    GetSettingIdsSqlRow,
    GetSettingSqlParams,
    GetSettingSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# SQL paths
ACCESS_SQL_PATH = "app/sql/v4/queries/settings/get_setting_access_complete.sql"
IDS_SQL_PATH = "app/sql/v4/queries/settings/get_setting_ids_complete.sql"
CONFIG_SQL_PATH = "app/sql/v4/queries/settings/get_setting_complete.sql"


router = APIRouter()


def _extract_setting_websocket_context(result: GetSettingSqlRow) -> dict[str, Any]:
    """Build minimal generation context payload for websocket consumers."""
    payload = result.model_dump()
    context_keys = (
        "group_id",
        "trace_id",
        "run_id",
        "domains",
        "tools",
        "tool_ids",
        "domain_ids",
        "agent_ids",
        "department_id",
        "provider_id",
        "model_id",
        "resource_group_ids",
        "generation_context",
    )
    return {
        key: payload.get(key) for key in context_keys if payload.get(key) is not None
    }


async def get_setting_internal(
    conn: asyncpg.Connection,
    params: GetSettingSqlParams,
) -> GetSettingSqlRow:
    """Internal SQL fetch layer for setting get endpoint."""
    return cast(
        GetSettingSqlRow,
        await execute_sql_typed(
            conn,
            CONFIG_SQL_PATH,
            params=params,
        ),
    )


def get_setting_websocket(result: GetSettingSqlRow) -> dict[str, Any]:
    """Websocket wrapper layer for setting generation context."""
    return _extract_setting_websocket_context(result)


def get_setting_client(result: GetSettingSqlRow) -> GetSettingApiResponse:
    """Client/BFF wrapper layer for setting get response."""
    payload = result.model_dump()
    if "generation_context" in payload:
        payload["generation_context"] = get_setting_websocket(result)
    return GetSettingApiResponse.model_validate(payload)


@router.post(
    "/get",
    response_model=GetSettingApiResponse,
    dependencies=[
        audit_activity(
            "setting.get",
            "{{ actor.name }} {% if setting %}viewed{% else %}opened new{% endif %} setting{% if setting %} '{{ setting.name }}'{% endif %}",
        )
    ],
)
async def get_setting(
    request: GetSettingApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSettingApiResponse:
    """Get setting information - handles both new (settings_id = NULL) and detail (settings_id provided).

    Validation Logic:
    - Tools are REQUIRED for resources - error if no tools exist (via missing_tools_check CTE)
    - Agents are OPTIONAL - NULL agent_id means manual entry only (no generate button shown)
    - Frontend components check agent_id before showing generate button
    """
    tags = ["settings"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetSettingApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(ACCESS_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Extract search and filter params from API request
        color_search = request.color_search
        draft_id = request.draft_id
        settings_id = request.settings_id  # Can be NULL for new mode

        # Get mcp flag from header (set by router-level dependency)
        mcp = getattr(http_request.state, "mcp", False) or False

        access_params = GetSettingAccessSqlParams(
            profile_id=profile_id,
            setting_id=settings_id,
            draft_id=draft_id,
        )
        sql_params = access_params.to_tuple()
        access_result = cast(
            GetSettingAccessSqlRow,
            await execute_sql_typed(conn, ACCESS_SQL_PATH, params=access_params),
        )

        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        setting_department_ids = access_result.setting_department_ids or []

        if settings_id is not None:
            if access_result.setting_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Setting {settings_id} not found"
                )
            if not has_access(user_role, user_department_ids, setting_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this setting. It may be restricted to other departments.",
                )

        ids_params = GetSettingIdsSqlParams(
            settings_id=settings_id,
            profile_id=profile_id,
            color_search=color_search,
            draft_id=draft_id,
            mcp=mcp,
        )
        sql_query = load_sql_query(IDS_SQL_PATH)
        sql_params = ids_params.to_tuple()
        ids_result = cast(
            GetSettingIdsSqlRow,
            await execute_sql_typed(conn, IDS_SQL_PATH, params=ids_params),
        )

        # Config payload (non-generation resources) is preserved from existing SQL contract.
        config_params = GetSettingSqlParams(
            settings_id=settings_id,
            profile_id=profile_id,
            color_search=color_search,
            draft_id=draft_id,
            mcp=mcp,
        )
        sql_query = load_sql_query(CONFIG_SQL_PATH)
        sql_params = config_params.to_tuple()
        config_result = await get_setting_internal(conn, config_params)

        can_edit = compute_can_edit(
            user_role=user_role,
            user_department_ids=user_department_ids,
            setting_department_ids=setting_department_ids,
        )
        disabled_reason = compute_disabled_reason(
            user_role=user_role,
            user_department_ids=user_department_ids,
            setting_department_ids=setting_department_ids,
        )

        # Set audit context
        if access_result.actor_name:
            audit_ctx = {"actor": {"name": access_result.actor_name, "id": profile_id}}
            # Only add setting to audit context if settings_id was provided (detail mode)
            if (
                settings_id
                and config_result.name_resource
                and config_result.name_resource.name
            ):
                audit_ctx["setting"] = {
                    "name": config_result.name_resource.name,
                    "id": str(settings_id),
                }
            audit_set(http_request, **audit_ctx)

        if settings_id is None:
            # New mode: check for valid departments (derive from departments array)
            departments_list = config_result.departments or []
            valid_department_ids = [
                d.department_id for d in departments_list if d.department_id
            ]
            if not valid_department_ids:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )
        payload = config_result.model_dump()
        payload.update(
            {
                "actor_name": access_result.actor_name,
                "setting_exists": access_result.setting_exists,
                "can_edit": can_edit,
                "disabled_reason": disabled_reason,
                "draft_version": access_result.draft_version,
                "group_id": access_result.group_id or payload.get("group_id"),
                "name_id": ids_result.name_id,
                "description_id": ids_result.description_id,
                "active_flag_id": ids_result.active_flag_id,
                "color_ids": ids_result.color_ids or [],
                "department_ids": ids_result.department_ids or [],
                "name_agent_id": ids_result.name_agent_id,
                "description_agent_id": ids_result.description_agent_id,
                "colors_agent_id": ids_result.colors_agent_id,
                "flag_agent_id": ids_result.flag_agent_id,
                "departments_agent_id": ids_result.departments_agent_id,
                "profiles_agent_id": ids_result.profiles_agent_id,
                "auths_agent_id": ids_result.auths_agent_id,
                "providers_agent_id": ids_result.providers_agent_id,
                "keys_agent_id": ids_result.keys_agent_id,
                "show_name": compute_show_name(),
                "show_description": compute_show_description(),
                "show_colors": compute_show_colors(len(payload.get("colors") or [])),
                "show_flag": compute_show_flag(),
                "show_departments": compute_show_departments(
                    len(payload.get("departments") or [])
                ),
                "name_required": compute_name_required(),
                "description_required": compute_description_required(),
                "colors_required": compute_colors_required(),
                "flag_required": compute_flag_required(),
                "departments_required": compute_departments_required(
                    compute_show_departments(len(payload.get("departments") or []))
                ),
            }
        )

        response_data = GetSettingApiResponse.model_validate(payload)

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
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
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
