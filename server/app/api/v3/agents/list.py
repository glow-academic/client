"""Agent list endpoint."""

from typing import Annotated, Any, cast

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetAgentsListAgentsItem, GetAgentsListApiRequest,
                           GetAgentsListSqlParams, GetAgentsListSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/get_agents_list_complete.sql"

# Response model matching actual API structure (dicts for mappings)
# TODO: Update SQL type generation to support dict outputs, then use GetAgentsListApiResponse
class AgentsListResponse(BaseModel):
    """API response for agents list with dict mappings."""
    agents: list[GetAgentsListAgentsItem]
    model_mapping: dict[str, dict[str, str]]
    department_mapping: dict[str, dict[str, str]]
    actor_name: str


router = APIRouter()


@router.post(
    "/list",
    response_model=AgentsListResponse,
    dependencies=[
        audit_activity("agents.list", "{{ actor.name }} visited the Agents page")
    ],
)
async def list_agents(
    request: GetAgentsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AgentsListResponse:
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
        return AgentsListResponse.model_validate(cached["data"])

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

        # Filter department_mapping to only include departments assigned to at least one agent
        # Collect all department IDs actually assigned to agents
        # Use model_dump() to access data since model_construct returns dict-like structures
        result_dict = result.model_dump()
        agents_list = result_dict.get("agents", [])
        assigned_department_ids = set()
        if agents_list:
            for agent in agents_list:
                if isinstance(agent, dict):
                    dept_ids = agent.get("department_ids", [])
                    if dept_ids:
                        assigned_department_ids.update(dept_ids)
                else:
                    # Handle Pydantic model
                    if hasattr(agent, "department_ids") and agent.department_ids:
                        assigned_department_ids.update(agent.department_ids)
        
        # Convert dict mappings to the expected format
        # result.department_mapping and result.model_mapping are now dicts (from dict_prefixes)
        model_mapping_raw = result_dict.get("model_mapping", {})
        department_mapping_raw = result_dict.get("department_mapping", {})
        
        model_mapping_dict: dict[str, dict[str, str]] = {}
        if isinstance(model_mapping_raw, dict):
            for model_id, model_item in model_mapping_raw.items():
                if isinstance(model_item, dict):
                    model_mapping_dict[str(model_id)] = {
                        "name": model_item.get("name", ""),
                        "description": model_item.get("description", ""),
                    }
        
        department_mapping_dict: dict[str, dict[str, str]] = {}
        if isinstance(department_mapping_raw, dict):
            for dept_id, dept_item in department_mapping_raw.items():
                # Only include departments assigned to at least one agent
                if str(dept_id) in assigned_department_ids:
                    if isinstance(dept_item, dict):
                        department_mapping_dict[str(dept_id)] = {
                            "name": dept_item.get("name", ""),
                            "description": dept_item.get("description", ""),
                        }

        # Convert agents list - ensure items are proper Pydantic models
        agents: list[GetAgentsListAgentsItem] = []
        for agent_data in agents_list:
            if isinstance(agent_data, dict):
                agents.append(GetAgentsListAgentsItem(**agent_data))
            else:
                agents.append(agent_data)

        # Convert SQL result to API response
        api_response = AgentsListResponse(
            agents=agents,
            model_mapping=model_mapping_dict,
            department_mapping=department_mapping_dict,
            actor_name=result_dict.get("actor_name", ""),
        )

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
