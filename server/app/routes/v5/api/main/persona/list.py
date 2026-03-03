"""Personas list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with active_scenario_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.v5.api.main.persona.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.persona.types import (
    ImportField,
    ListPersonaApiPersona,
    ListPersonaApiResponse,
)
from app.routes.v5.api.types import ListFilterOption, ListFilterSection
from app.routes.v5.tools.resources.departments.get import get_departments_internal
from app.routes.v5.tools.resources.fields.get import get_fields_internal
from app.routes.v5.tools.resources.scenarios.get import get_scenarios_internal
from app.sql.types import (
    GetPersonasListApiRequest,
    GetPersonasListSqlParams,
    GetPersonasListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/personas/get_personas_list_complete.sql"

PERSONA_IMPORT_FIELDS: list[ImportField] = [
    ImportField(
        key="name",
        label="Name",
        required=True,
        example="Sarah the Nurse",
        description="The persona's display name",
    ),
    ImportField(
        key="description",
        label="Description",
        example="A nurse with 5 years of experience",
        description="Optional description",
    ),
    ImportField(
        key="color",
        label="Color",
        required=True,
        example="#FF5733",
        description="Hex color code for the persona card",
    ),
    ImportField(
        key="icon",
        label="Icon",
        required=True,
        example="brain",
        description="Icon name from the icon library",
    ),
    ImportField(
        key="instructions",
        label="Instructions",
        required=True,
        example="You are a nurse helping patients...",
        description="System instructions for AI behavior",
    ),
    ImportField(
        key="active_flag",
        label="Active",
        type="boolean",
        example="true",
        description="Whether the persona is active (true/false)",
    ),
    ImportField(
        key="departments",
        label="Departments",
        multi=True,
        example="Nursing, Medicine",
        description="Comma-separated department names",
    ),
    ImportField(
        key="parameter_fields",
        label="Parameter Fields",
        multi=True,
        example="Patient Age, Condition",
        description="Comma-separated parameter field names",
    ),
    ImportField(
        key="examples",
        label="Examples",
        multi=True,
        example="Example conversation 1",
        description="Comma-separated example texts",
    ),
    ImportField(
        key="voices",
        label="Voices",
        multi=True,
        example="Alloy",
        description="Comma-separated voice names",
    ),
]

router = APIRouter()


@router.post("/list", response_model=ListPersonaApiResponse)
async def get_persona_list(
    request: GetPersonasListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListPersonaApiResponse:
    """Get personas list with permissions and scenario details."""
    tags = ["personas"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListPersonaApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=bypass_cache,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Convert API request to SQL params (add profile_id from header + request body fields)
        params = GetPersonasListSqlParams(
            profile_id=profile_id,
            search=request.search,
            scenario_ids=request.scenario_ids,
            field_ids=request.field_ids,
            filter_department_ids=request.filter_department_ids,
            scenario_search=request.scenario_search,
            field_search=request.field_search,
            department_search=request.department_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetPersonasListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # user_role already fetched from context above

        # Compute permissions for each persona in Python
        personas_with_permissions: list[ListPersonaApiPersona] = []
        for persona in result.personas or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                persona_department_ids=persona.department_ids,
                active_scenario_count=persona.active_scenario_count or 0,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                persona_department_ids=persona.department_ids,
                active_scenario_count=persona.active_scenario_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            personas_with_permissions.append(
                ListPersonaApiPersona(
                    persona_id=persona.persona_id,
                    name=persona.name,
                    description=persona.description,
                    color=persona.color,
                    icon=persona.icon,
                    department_ids=persona.department_ids,
                    scenario_ids=persona.scenario_ids,
                    field_ids=persona.field_ids,
                    is_inactive=persona.is_inactive,
                    generated=getattr(persona, "generated", None),
                    mcp=getattr(persona, "mcp", None),
                    num_scenarios=persona.num_scenarios,
                    num_profiles=getattr(persona, "num_profiles", None),
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=persona.updated_at,
                )
            )

        # --- Python hydration: filter option names from cached *_internal() ---
        # Extract option IDs and counts from SQL result
        scenario_option_ids = getattr(result, "scenario_option_ids", None) or []
        field_option_ids = getattr(result, "field_option_ids", None) or []
        department_option_ids = getattr(result, "department_option_ids", None) or []

        # Build ID -> count maps
        scenario_count_map: dict[UUID, int] = {}
        scenario_ids_to_fetch: list[UUID] = []
        for opt in scenario_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                scenario_count_map[uid] = int(opt_count or 0)
                scenario_ids_to_fetch.append(uid)

        field_count_map: dict[UUID, int] = {}
        field_ids_to_fetch: list[UUID] = []
        for opt in field_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                field_count_map[uid] = int(opt_count or 0)
                field_ids_to_fetch.append(uid)

        department_count_map: dict[UUID, int] = {}
        department_ids_to_fetch: list[UUID] = []
        for opt in department_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                department_count_map[uid] = int(opt_count or 0)
                department_ids_to_fetch.append(uid)

        # Parallel fetch names from cached *_internal() functions
        scenarios_data = []
        fields_data = []
        departments_data = []

        pool = get_pool()
        has_ids = any(
            [scenario_ids_to_fetch, field_ids_to_fetch, department_ids_to_fetch]
        )

        if pool and has_ids:

            async def fetch_scenarios() -> list:
                if not scenario_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_scenarios_internal(
                        c, scenario_ids_to_fetch, bypass_cache
                    )

            async def fetch_fields() -> list:
                if not field_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_fields_internal(
                        c, field_ids_to_fetch, bypass_cache
                    )

            async def fetch_departments() -> list:
                if not department_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, department_ids_to_fetch, bypass_cache
                    )

            scenarios_data, fields_data, departments_data = await asyncio.gather(
                fetch_scenarios(), fetch_fields(), fetch_departments()
            )

        # Merge names with counts, apply search filtering in Python
        scenario_search = request.scenario_search
        scenario_filter = ListFilterSection(
            options=[
                ListFilterOption(
                    id=str(s.scenario_id),
                    name=s.name,
                    count=scenario_count_map.get(s.scenario_id, 0)
                    if s.scenario_id
                    else 0,
                )
                for s in scenarios_data
                if s.scenario_id
                and (
                    scenario_search is None
                    or scenario_search.lower() in (s.name or "").lower()
                )
            ],
            selected_ids=[str(sid) for sid in (request.scenario_ids or [])]
            if request.scenario_ids
            else None,
            search=request.scenario_search,
        )

        field_search = request.field_search
        field_filter = ListFilterSection(
            options=[
                ListFilterOption(
                    id=str(f.field_id),
                    name=f.name,
                    count=field_count_map.get(f.field_id, 0) if f.field_id else 0,
                )
                for f in fields_data
                if f.field_id
                and (
                    field_search is None
                    or field_search.lower() in (f.name or "").lower()
                )
            ],
            selected_ids=[str(fid) for fid in (request.field_ids or [])]
            if request.field_ids
            else None,
            search=request.field_search,
        )

        department_search = request.department_search
        department_filter = ListFilterSection(
            options=[
                ListFilterOption(
                    id=str(d.department_id),
                    name=d.name,
                    count=department_count_map.get(d.department_id, 0)
                    if d.department_id
                    else 0,
                )
                for d in departments_data
                if d.department_id
                and (
                    department_search is None
                    or department_search.lower() in (d.name or "").lower()
                )
            ],
            selected_ids=[str(did) for did in (request.filter_department_ids or [])]
            if request.filter_department_ids
            else None,
            search=request.department_search,
        )

        # Build API response with computed permissions
        api_response = ListPersonaApiResponse(
            actor_name=actor_name,
            personas=personas_with_permissions,
            scenario_filter=scenario_filter,
            field_filter=field_filter,
            department_filter=department_filter,
            total_count=result.total_count,
            import_fields=PERSONA_IMPORT_FIELDS,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_persona_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
