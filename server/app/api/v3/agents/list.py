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
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/get_agents_list_complete.sql"

# Extended response model for list endpoint (aggregates multiple rows)
class AgentsListResponse(BaseModel):
    agents: list[GetAgentsListApiResponse]
    model_mapping: dict[str, dict[str, str]]
    department_mapping: dict[str, dict[str, str]]


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
        result = cast(
            GetAgentsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
                list_prefixes={"agents", "model_mapping", "department_mapping"},
            ),
        )

        result_dict = result.model_dump()

        # Convert lists to dicts for model_mapping and department_mapping
        # nest_many returns lists, but we need dicts keyed by id
        model_mapping_list = result_dict.get("model_mapping", [])
        model_mapping: dict[str, dict[str, str]] = {}
        for model in model_mapping_list:
            if isinstance(model, dict) and "id" in model:
                model_mapping[model["id"]] = {
                    "name": model.get("name", ""),
                    "description": model.get("description", ""),
                }

        department_mapping_list = result_dict.get("department_mapping", [])
        department_mapping: dict[str, dict[str, str]] = {}
        for dept in department_mapping_list:
            if isinstance(dept, dict) and "id" in dept:
                department_mapping[dept["id"]] = {
                    "name": dept.get("name", ""),
                    "description": dept.get("description", ""),
                }

        # Get agents list
        agents_list = result_dict.get("agents", [])
        agents: list[GetAgentsListApiResponse] = []
        for agent_data in agents_list:
            if isinstance(agent_data, dict):
                # Format updated_at if needed
                updated_at = agent_data.get("updated_at")
                if updated_at and hasattr(updated_at, "isoformat"):
                    agent_data["updated_at"] = updated_at.isoformat()
                elif updated_at and not isinstance(updated_at, str):
                    agent_data["updated_at"] = str(updated_at)
                
                # Ensure department_ids is a list of strings
                dept_ids = agent_data.get("department_ids", [])
                if dept_ids:
                    agent_data["department_ids"] = [str(d) for d in dept_ids]
                else:
                    agent_data["department_ids"] = []
                
                agents.append(GetAgentsListApiResponse(**agent_data))

        # Collect all department IDs actually assigned to agents
        assigned_department_ids = set()
        for agent in agents:
            if agent.department_ids:
                assigned_department_ids.update(agent.department_ids)
        
        # Filter department_mapping to only include departments assigned to at least one agent
        filtered_department_mapping = {
            did: d
            for (did, d) in department_mapping.items()
            if did in assigned_department_ids
        }

        # Set audit context
        actor_name = result_dict.get("actor_name")
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        response_data = AgentsListResponse(
            agents=agents,
            model_mapping=model_mapping,
            department_mapping=filtered_department_mapping,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
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
