"""Parameter get endpoint - Three-layer architecture.

This implements the three-layer BFF pattern:
1. get_parameter_internal() - Core data fetching (cacheable, returns dataclass)
2. get_parameter_websocket() - Minimal data for WebSocket handlers
3. get_parameter_client() - Full BFF response for HTTP endpoint/frontend

The internal layer handles SQL queries and resource fetching.
The presentation layers transform internal data into consumer-specific formats.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.parameter.permissions import (
    PARAMETER_FLAG_NAMES,
    PARAMETER_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_fields_required,
    compute_flag_required,
    compute_name_required,
    compute_show_departments,
    compute_show_description,
    compute_show_fields,
    compute_show_flag,
    compute_show_name,
    has_access,
)
from app.api.v4.artifacts.parameter.types import (
    GetParameterApiRequest,
    GetParameterApiResponse,
    GetParameterWebsocketResponse,
    ParameterDepartmentSection,
    ParameterDescriptionSection,
    ParameterFieldSection,
    ParameterFlagConfig,
    ParameterFlagSection,
    ParameterInternalData,
    ParameterNameSection,
    ParameterResourceBucket,
    ParameterResources,
    ParameterWebsocketResources,
    ParameterWebsocketEntries,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.auth.settings import get_auth_settings_internal
from app.api.v4.entries.parameter_drafts.get import (
    get_parameter_drafts_entries_internal,
)
from app.api.v4.entries.runs.search import get_run_list_entries_internal
from app.api.v4.permissions import has_tools_for_resource, resolve_agents_for_artifact
from app.api.v4.resources.agents.get import get_agents_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.departments.search import search_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.descriptions.search import search_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.flags.search import search_flags_internal
from app.api.v4.resources.models.get import get_models_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameter_fields.search import (
    search_parameter_fields_internal,
)
from app.api.v4.resources.profiles.get import get_profiles_internal
from app.api.v4.resources.providers.get import get_providers_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetParameterAccessSqlParams,
    GetParameterAccessSqlRow,
    GetParameterIdsSqlParams,
    GetParameterIdsSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

# SQL paths
QUERY1_SQL_PATH = "app/sql/v4/queries/parameters/get_parameter_access_complete.sql"
QUERY2_SQL_PATH = "app/sql/v4/queries/parameters/get_parameter_ids_complete.sql"

router = APIRouter()


async def get_parameter_internal(
    profile_id: UUID,
    parameter_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> ParameterInternalData:
    """Core data fetching layer (cacheable)."""

    pool = get_pool()
    if not pool:
        raise RuntimeError("Database pool not initialized")

    draft_item = None
    if draft_id is not None:
        async with pool.acquire() as draft_conn:
            draft_items = await get_parameter_drafts_entries_internal(
                conn=draft_conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            if draft_items:
                draft_item = draft_items[0]

    # Fetch user context for permissions
    async with pool.acquire() as context_conn:
        profile_ctx = await get_auth_profile_internal(
            conn=context_conn,
            profile_id=profile_id,
            bypass_cache=bypass_cache,
        )
    user_role = profile_ctx.access.role
    actor_name = profile_ctx.access.actor_name
    user_department_ids = [
        d.department_id for d in profile_ctx.departments if d.department_id
    ]

    async with pool.acquire() as conn:
        query1_params = GetParameterAccessSqlParams(
            profile_id=profile_id,
            parameter_id=parameter_id,
            draft_id=draft_id,
            draft_group_id=draft_item.group_id if draft_item is not None else None,
            draft_version=draft_item.version if draft_item is not None else None,
        )

        access_result = cast(
            GetParameterAccessSqlRow,
            await execute_sql_typed(conn, QUERY1_SQL_PATH, params=query1_params),
        )

        parameter_department_ids = access_result.parameter_department_ids or []
        active_scenario_count = access_result.active_scenario_count or 0

        if parameter_id is not None:
            if access_result.parameter_exists is False:
                raise HTTPException(
                    status_code=404,
                    detail=f"Parameter {parameter_id} not found",
                )
            if not has_access(user_role, user_department_ids, parameter_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this parameter. It may be restricted to other departments.",
                )

        # group_id is guaranteed by SQL (created inline if no draft)
        effective_group_id = access_result.group_id
        effective_draft_version = access_result.effective_draft_version

        query2_params = GetParameterIdsSqlParams(
            profile_id=profile_id,
            parameter_id=parameter_id,
            draft_id=draft_id,
            group_id=effective_group_id,
            user_department_ids=user_department_ids,
        )

        ids_result = cast(
            GetParameterIdsSqlRow,
            await execute_sql_typed(conn, QUERY2_SQL_PATH, params=query2_params),
        )

    selected_name_id = ids_result.name_id
    selected_description_id = ids_result.description_id
    selected_active_flag_id = ids_result.active_flag_id
    selected_flag_ids = ids_result.flag_ids or []

    selected_department_ids = ids_result.department_ids or []
    selected_field_ids = ids_result.field_ids or []

    if draft_item is not None:
        if draft_item.name_ids:
            selected_name_id = draft_item.name_ids[0]
        if draft_item.description_ids:
            selected_description_id = draft_item.description_ids[0]
        if draft_item.flag_ids:
            selected_flag_ids = draft_item.flag_ids
            selected_active_flag_id = draft_item.flag_ids[0]
        if draft_item.department_ids:
            selected_department_ids = draft_item.department_ids
        if draft_item.field_ids:
            selected_field_ids = draft_item.field_ids

    # === RESOLVE AGENTS FROM SETTINGS (source of truth) ===
    async with pool.acquire() as settings_conn:
        settings_data = await get_auth_settings_internal(
            settings_conn, profile_id, bypass_cache
        )

    agent_ids, create_tool_ids_map, link_tool_ids_map = resolve_agents_for_artifact(
        settings_data.agent_tool_entries, PARAMETER_RESOURCES
    )

    # Derive has_tools flags from settings
    names_has_tools = has_tools_for_resource(settings_data.agent_tool_entries, "names")

    def compute_show_ai_generate(resource: str) -> bool:
        return agent_ids.get(resource) is not None

    name_show_ai_generate = compute_show_ai_generate("names")
    description_show_ai_generate = compute_show_ai_generate("descriptions")
    flag_show_ai_generate = compute_show_ai_generate("flags")
    departments_show_ai_generate = compute_show_ai_generate("departments")
    fields_show_ai_generate = compute_show_ai_generate("fields")

    basic_show_ai_generate = any(
        [
            name_show_ai_generate,
            description_show_ai_generate,
            flag_show_ai_generate,
            departments_show_ai_generate,
        ]
    )
    fields_step_show_ai_generate = fields_show_ai_generate

    can_edit = compute_can_edit(
        user_role=user_role,
        parameter_department_ids=parameter_department_ids,
        active_scenario_count=active_scenario_count,
        user_department_ids=user_department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=user_role,
        parameter_department_ids=parameter_department_ids,
        active_scenario_count=active_scenario_count,
        user_department_ids=user_department_ids,
    )

    # === PASS 2: Parallel Resource Fetching ===
    name_ids = [selected_name_id] if selected_name_id else []
    description_ids = [selected_description_id] if selected_description_id else []
    flag_ids = [selected_active_flag_id] if selected_active_flag_id else []
    department_ids = selected_department_ids
    field_ids = selected_field_ids

    async def fetch_names():
        async with pool.acquire() as c:
            selected = await get_names_internal(c, name_ids, bypass_cache)
            suggestions = await search_names_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                None,
                name_ids,
                bypass_cache,
                parameter=True,
            )
            return (selected, suggestions)

    async def fetch_descriptions():
        async with pool.acquire() as c:
            selected = await get_descriptions_internal(c, description_ids, bypass_cache)
            suggestions = await search_descriptions_internal(
                c,
                None,
                20,
                0,
                effective_group_id,
                "recent",
                description_ids,
                bypass_cache,
                parameter=True,
            )
            return (selected, suggestions)

    async def fetch_flags():
        async with pool.acquire() as c:
            selected = await get_flags_internal(c, flag_ids, bypass_cache)
            all_flags = await search_flags_internal(
                c,
                None,
                50,
                0,
                flag_ids,
                bypass_cache,
                parameter=True,
            )
            suggestions = [f for f in all_flags if f.name in PARAMETER_FLAG_NAMES]
            return (selected, suggestions)

    async def fetch_departments():
        async with pool.acquire() as c:
            selected = await get_departments_internal(c, department_ids, bypass_cache)
            suggestions = await search_departments_internal(
                c,
                search=None,
                limit_count=20,
                offset_count=0,
                department_ids=user_department_ids,
                suggest_source="all",
                exclude_ids=department_ids,
                bypass_cache=bypass_cache,
                parameter=True,
            )
            return (selected, suggestions)

    async def fetch_fields():
        async with pool.acquire() as c:
            selected = await get_parameter_fields_internal(c, field_ids, bypass_cache)
            available = await search_parameter_fields_internal(c, [], bypass_cache)
            return (selected, available)

    (
        (names_selected, names_suggestions),
        (descriptions_selected, descriptions_suggestions),
        (flags_selected, flags_suggestions),
        (departments_selected, departments_suggestions),
        (fields_selected, fields_suggestions),
    ) = await asyncio.gather(
        fetch_names(),
        fetch_descriptions(),
        fetch_flags(),
        fetch_departments(),
        fetch_fields(),
    )

    names = _dedupe_by_id(names_selected + names_suggestions, "id")
    descriptions = _dedupe_by_id(descriptions_selected + descriptions_suggestions, "id")
    flags = _dedupe_by_id(flags_selected + flags_suggestions, "id")
    departments = _dedupe_by_id(
        departments_selected + departments_suggestions, "department_id"
    )
    parameter_fields = _dedupe_by_id(fields_selected + fields_suggestions, "field_id")

    name_resource = next((n for n in names if n.id == selected_name_id), None)
    description_resource = next(
        (d for d in descriptions if d.id == selected_description_id),
        None,
    )
    flag_resource = next((f for f in flags if f.id == selected_active_flag_id), None)

    department_resources = [
        d for d in departments if d.department_id in selected_department_ids
    ]
    field_resources = [f for f in parameter_fields if f.id in selected_field_ids]

    name_suggestion_ids = [n.id for n in names_suggestions]
    description_suggestion_ids = [d.id for d in descriptions_suggestions]
    department_suggestion_ids = [d.department_id for d in departments_suggestions]
    field_suggestion_ids = [f.id for f in fields_suggestions]

    show_name = compute_show_name(names_has_tools)
    show_description_flag = compute_show_description()
    show_flag = compute_show_flag()
    show_departments_flag = compute_show_departments(len(departments))
    show_fields_flag = compute_show_fields(len(parameter_fields))

    show_flags_map = {
        "names": show_name,
        "descriptions": show_description_flag,
        "flags": show_flag,
        "departments": show_departments_flag,
        "fields": show_fields_flag,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "fields": compute_fields_required(),
    }

    parameter_flags = [
        ParameterFlagConfig(
            key=derive_flag_key_and_label(flag.name)[0],
            label=derive_flag_key_and_label(flag.name)[1],
            description=flag.description,
            icon_id=flag.icon,
            flag_option_id=flag.id,
            show=show_flag,
            required=compute_flag_required(),
            generated=flag.generated,
        )
        for flag in flags
        if flag.id
    ]
    selected_flag_ids = list(
        {
            *selected_flag_ids,
            *([selected_active_flag_id] if selected_active_flag_id else []),
        }
    )
    current_flags = [
        f for f in parameter_flags if f.flag_option_id in set(selected_flag_ids)
    ]

    if parameter_id is None:
        if not departments:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

    if parameter_id is not None and not name_resource:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this parameter. It may be restricted to other departments.",
        )

    resources_payload = ParameterResources(
        resources=ParameterResourceBucket(
            names=names,
            descriptions=descriptions,
            flags=parameter_flags,
            departments=departments,
            fields=parameter_fields,
        ),
        current=ParameterResourceBucket(
            names=[name_resource] if name_resource else [],
            descriptions=[description_resource] if description_resource else [],
            flags=current_flags,
            departments=department_resources or [],
            fields=field_resources or [],
        ),
    )

    show_ai_generate_map = {
        "names": name_show_ai_generate,
        "descriptions": description_show_ai_generate,
        "flags": flag_show_ai_generate,
        "departments": departments_show_ai_generate,
        "fields": fields_show_ai_generate,
    }

    suggestions_map = {
        "names": name_suggestion_ids,
        "descriptions": description_suggestion_ids,
        "departments": department_suggestion_ids,
        "fields": field_suggestion_ids,
    }

    # Config chain from settings (agents + tools already hydrated, models/providers need fetch)
    config_agent_resource_ids = [a.id for a in settings_data.settings_agents if a.id]
    config_model_resource_ids = [
        a.model_id for a in settings_data.settings_agents if a.model_id
    ]

    config_agents: list[Any] = []
    config_models: list[Any] = []
    config_providers: list[Any] = []
    if config_agent_resource_ids:
        async with pool.acquire() as c:
            config_agents = await get_agents_internal(
                c, config_agent_resource_ids, bypass_cache
            )
    if config_model_resource_ids:
        async with pool.acquire() as c:
            config_models = await get_models_internal(
                c, config_model_resource_ids, bypass_cache
            )
        provider_ids = list(
            dict.fromkeys(m.provider_id for m in config_models if m.provider_id)
        )
        if provider_ids:
            async with pool.acquire() as c:
                config_providers = await get_providers_internal(
                    c, provider_ids, bypass_cache
                )

    return ParameterInternalData(
        actor_name=actor_name,
        parameter_exists=access_result.parameter_exists,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=effective_draft_version,
        group_id=effective_group_id,
        agent_ids=agent_ids,
        show_flags_map=show_flags_map,
        required_flags_map=required_flags_map,
        suggestions_map=suggestions_map,
        show_ai_generate_map=show_ai_generate_map,
        basic_show_ai_generate=basic_show_ai_generate,
        fields_step_show_ai_generate=fields_step_show_ai_generate,
        resources_payload=resources_payload,
        create_tool_ids_map=create_tool_ids_map,
        link_tool_ids_map=link_tool_ids_map,
        config_agent_resources=config_agents,
        config_model_resources=config_models,
        config_provider_resources=config_providers,
    )


async def get_parameter_websocket(
    profile_id: UUID,
    parameter_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetParameterWebsocketResponse:
    """Minimal response for WebSocket handlers."""
    data = await get_parameter_internal(
        profile_id=profile_id,
        parameter_id=parameter_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    # Fetch draft, config_profile, and runs_today in parallel
    pool = get_pool()

    async def fetch_draft():
        if not draft_id or not pool:
            return None
        async with pool.acquire() as conn:
            draft_items = await get_parameter_drafts_entries_internal(
                conn=conn,
                ids=[draft_id],
                bypass_cache=bypass_cache,
            )
            return draft_items[0] if draft_items else None

    async def fetch_config_profile():
        if not pool:
            return None
        async with pool.acquire() as conn:
            return await get_profiles_internal(conn, [profile_id], bypass_cache)

    async def fetch_runs_today():
        if not pool:
            return None
        from datetime import UTC, datetime

        today_utc = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        tomorrow_utc = today_utc.replace(hour=23, minute=59, second=59)
        async with pool.acquire() as conn:
            return await get_run_list_entries_internal(
                conn=conn,
                profile_id_filter=profile_id,
                date_from=today_utc,
                date_to=tomorrow_utc,
                page_limit=1,
                bypass_cache=True,
            )

    (draft_view, config_profile_result, runs_result) = await asyncio.gather(
        fetch_draft(),
        fetch_config_profile(),
        fetch_runs_today(),
    )

    current = data.resources_payload.current

    entries = ParameterWebsocketEntries(draft_parameter=draft_view, runs=runs_result)

    return GetParameterWebsocketResponse(
        entries=entries if draft_view or runs_result else None,
        resources=ParameterWebsocketResources(
            names=current.names if current else None,
            descriptions=current.descriptions if current else None,
            flags=current.flags if current else None,
            departments=current.departments if current else None,
            fields=current.fields if current else None,
            config_agents=data.config_agent_resources,
            config_models=data.config_model_resources,
            config_providers=data.config_provider_resources,
            config_tools=None,
            config_args=None,
            config_args_outputs=None,
            config_profile=config_profile_result or None,
        ),
        resource_agent_ids=data.agent_ids,
        group_id=data.group_id,
    )


async def get_parameter_client(
    profile_id: UUID,
    parameter_id: UUID | None,
    draft_id: UUID | None = None,
    bypass_cache: bool = False,
) -> GetParameterApiResponse:
    """Section-first BFF response for HTTP endpoint/frontend."""
    data = await get_parameter_internal(
        profile_id=profile_id,
        parameter_id=parameter_id,
        draft_id=draft_id,
        bypass_cache=bypass_cache,
    )

    all_resources = data.resources_payload.resources
    current = data.resources_payload.current

    def section_common(resource_key: str) -> dict[str, Any]:
        return {
            "show": data.show_flags_map.get(resource_key, False),
            "required": data.required_flags_map.get(resource_key, False),
            "suggestions": data.suggestions_map.get(resource_key),
            "show_ai_generate": data.show_ai_generate_map.get(resource_key, False),
            "create_tool_id": data.create_tool_ids_map.get(resource_key),
            "link_tool_id": data.link_tool_ids_map.get(resource_key),
        }

    return GetParameterApiResponse(
        actor_name=data.actor_name,
        parameter_exists=data.parameter_exists,
        can_edit=data.can_edit,
        disabled_reason=data.disabled_reason,
        draft_version=data.draft_version,
        group_id=data.group_id,
        basic_show_ai_generate=data.basic_show_ai_generate,
        fields_step_show_ai_generate=data.fields_step_show_ai_generate,
        names=ParameterNameSection(
            **section_common("names"),
            resource=(current.names[0] if current and current.names else None),
            resources=all_resources.names if all_resources else [],
        ),
        descriptions=ParameterDescriptionSection(
            **section_common("descriptions"),
            resource=(
                current.descriptions[0] if current and current.descriptions else None
            ),
            resources=all_resources.descriptions if all_resources else [],
        ),
        flags=ParameterFlagSection(
            **section_common("flags"),
            current=current.flags if current else [],
            resources=all_resources.flags if all_resources else [],
        ),
        departments=ParameterDepartmentSection(
            **section_common("departments"),
            current=current.departments if current else [],
            resources=all_resources.departments if all_resources else [],
        ),
        fields=ParameterFieldSection(
            **section_common("fields"),
            current=current.fields if current else [],
            resources=all_resources.fields if all_resources else [],
        ),
    )


def derive_flag_key_and_label(name: str | None) -> tuple[str, str]:
    """Derive key and label from flag name like 'parameter_active' -> ('active', 'Active')"""
    if not name:
        return ("unknown", "Unknown")
    key = name.replace("parameter_", "")
    label = key.replace("_", " ").title()
    return (key, label)


def _dedupe_by_id(items: list[Any], id_attr: str) -> list[Any]:
    """Preserve order while deduplicating by id attribute."""
    seen: set[UUID] = set()
    output: list[Any] = []
    for item in items:
        item_id = getattr(item, id_attr, None)
        if item_id and item_id not in seen:
            seen.add(item_id)
            output.append(item)
    return output


@router.post(
    "/get",
    response_model=GetParameterApiResponse,
    dependencies=[
        audit_activity(
            "parameter.get",
            "{{ actor.name }} {% if parameter %}viewed{% else %}opened new{% endif %} parameter{% if parameter %} '{{ parameter.name }}'{% endif %}",
        )
    ],
)
async def get_parameter(
    request: GetParameterApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetParameterApiResponse:
    """Get parameter information using two-pass architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        response_data = await get_parameter_client(
            profile_id=profile_id,
            parameter_id=request.parameter_id,
            draft_id=request.draft_id,
            bypass_cache=bypass_cache,
        )

        if response_data.actor_name:
            audit_ctx: dict[str, Any] = {
                "actor": {"name": response_data.actor_name, "id": profile_id}
            }
            current_name = None
            current_resources = (
                response_data.resources.current if response_data.resources else None
            )
            if current_resources and current_resources.names:
                current_name = getattr(current_resources.names[0], "name", None)
            if request.parameter_id and current_name:
                audit_ctx["parameter"] = {
                    "name": current_name,
                    "id": str(request.parameter_id),
                }
            audit_set(http_request, **audit_ctx)

        response.headers["X-Cache-Tags"] = "parameters"
        response.headers["X-Cache-Hit"] = "0"
        response.headers["X-Two-Pass"] = "1"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_parameter",
            sql_query=load_sql_query(QUERY1_SQL_PATH),
            sql_params=None,
            request=http_request,
        )
