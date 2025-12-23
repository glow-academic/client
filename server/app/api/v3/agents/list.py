"""Agent list endpoint."""

from typing import Annotated, Any

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetAgentsListApiRequest,
    GetAgentsListApiResponse,
    GetAgentsListSqlParams,
    GetAgentsListSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql
from utils.sql_nest import nest_many

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

        # Convert API request to SQL params (add profile_id from header)
        params = GetAgentsListSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute query (returns multiple rows)
        rows = await conn.fetch(sql_query, *sql_params)

        if not rows:
            # Return empty response
            response_data = AgentsListResponse(
                agents=[],
                model_mapping={},
                department_mapping={},
            )
            await set_cached(
                cache_key_val,
                {"data": response_data.model_dump()},
                ttl=60,
                tags=tags,
            )
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "0"
            return response_data

        # Process rows individually and aggregate
        # Use nest_many on all rows to extract department_mapping (shared across rows)
        nested_data = nest_many(rows, list_prefixes={"department_mapping"})

        # Extract department_mapping list and convert to dict
        department_mapping_list = nested_data.get("department_mapping", [])
        department_mapping: dict[str, dict[str, str]] = {}
        for dept in department_mapping_list:
            dept_id = dept.get("id")
            if dept_id:
                department_mapping[dept_id] = {
                    "name": dept.get("name", ""),
                    "description": dept.get("description", ""),
                }

        # Get actor name from first row (same for all rows)
        actor_name = rows[0].get("actor_name") if rows else None
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Build agents list and model mapping from rows (deduplicate by agent_id)
        seen_agents: set[str] = set()
        agents: list[GetAgentsListApiResponse] = []
        model_mapping: dict[str, dict[str, str]] = {}

        for row in rows:
            agent_id = row["agent_id"]
            if agent_id in seen_agents:
                continue
            seen_agents.add(agent_id)

            # Add to model mapping if we have model info
            model_id = row["model_id"]
            if model_id and model_id not in model_mapping:
                model_mapping[model_id] = {
                    "name": row["model_name"] or "",
                    "description": row["model_description"] or "",
                }

            # Parse department_ids
            dept_ids = []
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Format updated_at
            updated_at = row["updated_at"]
            if hasattr(updated_at, "isoformat"):
                updated_at = updated_at.isoformat()
            elif not isinstance(updated_at, str):
                updated_at = str(updated_at)

            # Create typed agent item from row data
            agent_dict = dict(row)
            agent_dict["department_ids"] = dept_ids
            agent_dict["updated_at"] = updated_at
            # Process nested department_mapping for this row
            row_nested = nest_many([row], list_prefixes={"department_mapping"})
            agent_dict["department_mapping"] = row_nested.get("department_mapping", [])
            agent_item = GetAgentsListApiResponse(**agent_dict)
            agents.append(agent_item)

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
