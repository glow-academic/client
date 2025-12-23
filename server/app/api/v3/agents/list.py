"""Agent list endpoint."""

from typing import Annotated, Any, cast

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetAgentsListApiRequest, GetAgentsListApiResponse,
                           GetAgentsListSqlParams, GetAgentsListSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/get_agents_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=GetAgentsListApiResponse,
    dependencies=[
        audit_activity("agents.list", "{{ actor.name }} visited the Agents page")
    ],
)
async def list_agents(
    request: GetAgentsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAgentsListApiResponse:
    """Get list of agents with permissions."""
    tags = ["agents"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetAgentsListApiResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        params = GetAgentsListSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute query with typed helper and nesting
        # Use dict_prefixes to convert model_mapping and department_mapping lists to dicts
        result = cast(
            GetAgentsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
                list_prefixes={"agents", "model_mapping", "department_mapping"},
                dict_prefixes={"model_mapping": "id", "department_mapping": "id"},
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Get runtime structure (dict_prefixes converts lists to dicts at runtime)
        result_dict = result.model_dump()
        
        # Filter department_mapping to only include departments assigned to at least one agent
        # Collect all department IDs actually assigned to agents
        assigned_department_ids = set()
        agents_list = result_dict.get("agents", [])
        for agent in agents_list:
            if isinstance(agent, dict):
                dept_ids = agent.get("department_ids", [])
                if dept_ids:
                    assigned_department_ids.update(dept_ids)
            elif hasattr(agent, "department_ids") and agent.department_ids:
                assigned_department_ids.update(agent.department_ids)
        
        # Filter department_mapping dict to only include assigned departments
        department_mapping_dict = result_dict.get("department_mapping", {})
        if isinstance(department_mapping_dict, dict):
            filtered_department_mapping = {
                str(dept_id): dept_item
                for dept_id, dept_item in department_mapping_dict.items()
                if str(dept_id) in assigned_department_ids
            }
        else:
            filtered_department_mapping = {}

        # Convert SQL result to API response
        api_response = GetAgentsListApiResponse.model_validate({
            **result_dict,
            "department_mapping": filtered_department_mapping,
        })

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump()},
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
            operation="list_agents",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
