"""Personas list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with active_scenario_count and total_scenario_links
2. Python computes permissions (can_edit, can_delete, can_duplicate)
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.persona.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.persona.types import (
    ListPersonaApiDepartment,
    ListPersonaApiField,
    ListPersonaApiPersona,
    ListPersonaApiResponse,
    ListPersonaApiScenario,
)
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPersonasListApiRequest,
    GetPersonasListSqlParams,
    GetPersonasListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/personas/get_personas_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListPersonaApiResponse,
    dependencies=[
        audit_activity("personas.list", "{{ actor.name }} visited the Personas page")
    ],
)
async def get_persona_list(
    request: GetPersonasListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListPersonaApiResponse:
    """Get personas list with permissions and scenario details."""
    tags = ["personas"]  # From router tags

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

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Get user_role from SQL result for Python permission computation
        user_role = result.user_role

        # Compute permissions for each persona in Python
        personas_with_permissions: list[ListPersonaApiPersona] = []
        for persona in result.personas or []:
            # Compute permissions based on user role and persona state
            can_edit_val = compute_can_edit(
                user_role=user_role,
                persona_department_ids=persona.department_ids,
                active_scenario_count=persona.active_scenario_count or 0,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                persona_department_ids=persona.department_ids,
                total_scenario_links=persona.total_scenario_links or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            # Create persona with computed permissions
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
                    reasoning=persona.reasoning,
                    temperature_display=persona.temperature_display,
                    is_inactive=persona.is_inactive,
                    num_scenarios=persona.num_scenarios,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=persona.updated_at,
                )
            )

        # Transform scenarios, fields, departments to API types
        scenarios = [
            ListPersonaApiScenario(
                scenario_id=s.scenario_id,
                name=s.name,
                description=s.description,
                active=s.active,
                persona_ids=s.persona_ids,
                document_ids=s.document_ids,
                parameter_item_ids=s.parameter_item_ids,
                count=s.count,
            )
            for s in (result.scenarios or [])
        ]

        fields = [
            ListPersonaApiField(
                field_id=f.field_id,
                name=f.name,
                description=f.description,
                count=f.count,
            )
            for f in (result.fields or [])
        ]

        departments = [
            ListPersonaApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description,
                count=d.count,
            )
            for d in (result.departments or [])
        ]

        # Build API response with computed permissions
        api_response = ListPersonaApiResponse(
            actor_name=result.actor_name,
            personas=personas_with_permissions,
            scenarios=scenarios,
            fields=fields,
            departments=departments,
            total_count=result.total_count,
            general_agent_id=result.general_agent_id,
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
