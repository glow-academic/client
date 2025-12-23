"""Agent list endpoint."""

from typing import Annotated, Any

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql
from utils.sql_nest import nest_many


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class ModelMappingItem(BaseModel):
    """Model mapping item."""

    name: str
    description: str


# Type aliases for Dict mappings
DepartmentMapping = dict[str, DepartmentMappingItem]
ModelMapping = dict[str, ModelMappingItem]


# Inline request/response schemas
class AgentsListRequest(BaseModel):
    pass
    # profileId removed - comes from X-Profile-Id header


class AgentItem(BaseModel):
    agent_id: str
    name: str
    description: str
    reasoning: str | None
    temperature: float
    model_id: str
    role: str
    department_ids: list[str] | None
    updated_at: str
    can_edit: bool
    can_duplicate: bool
    can_delete: bool


class AgentsListResponse(BaseModel):
    agents: list[AgentItem]
    model_mapping: ModelMapping
    department_mapping: DepartmentMapping


router = APIRouter()


@router.post(
    "/list",
    response_model=AgentsListResponse,
    dependencies=[
        audit_activity("agents.list", "{{ actor.name }} visited the Agents page")
    ],
)
async def list_agents(
    request: AgentsListRequest,
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
        # Load SQL string
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        sql_query = load_sql("app/sql/v3/agents/get_agents_list_complete.sql")
        sql_params = (profile_id,)

        # Execute query
        rows = await conn.fetch(sql_query, profile_id)

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

        # Use nest_many to handle department_mapping list
        # Since department_mapping is shared across all rows, we'll get it from the nested result
        nested_data = nest_many(rows, list_prefixes={"department_mapping"})

        # Extract department_mapping list and convert to dict
        # nest_many removes the prefix, so "department_mapping__id" becomes "id" in the nested list
        department_mapping_list = nested_data.get("department_mapping", [])
        department_mapping: dict[str, DepartmentMappingItem] = {}
        for dept in department_mapping_list:
            dept_id = dept.get("id")  # This is from "department_mapping__id"
            if dept_id:
                department_mapping[dept_id] = DepartmentMappingItem(
                    name=dept.get("name", ""),  # This is from "department_mapping__name"
                    description=dept.get("description", ""),  # This is from "department_mapping__description"
                )

        # Get actor name from nested data
        actor_name = nested_data.get("actor_name")
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Build agents list and model mapping from original rows (deduplicate by agent_id)
        seen_agents: set[str] = set()
        agents: list[AgentItem] = []
        model_mapping: ModelMapping = {}

        for row in rows:
            agent_id = row["agent_id"]
            if agent_id in seen_agents:
                continue
            seen_agents.add(agent_id)

            # Add to model mapping if we have model info
            model_id = row["model_id"]
            if model_id and model_id not in model_mapping:
                model_mapping[model_id] = ModelMappingItem(
                    name=row["model_name"] or "",
                    description=row["model_description"] or "",
                )

            # Parse department_ids
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            # Format updated_at
            updated_at = row["updated_at"]
            if hasattr(updated_at, "isoformat"):
                updated_at = updated_at.isoformat()
            elif not isinstance(updated_at, str):
                updated_at = str(updated_at)

            agents.append(
                AgentItem(
                    agent_id=agent_id,
                    name=row["name"],
                    description=row["description"],
                    reasoning=row["reasoning"],
                    temperature=float(row["temperature"])
                    if row["temperature"] is not None
                    else 0.0,
                    model_id=model_id,
                    role=row["role"],
                    department_ids=dept_ids,
                    updated_at=updated_at,
                    can_edit=row["can_edit"],
                    can_duplicate=row["can_duplicate"],
                    can_delete=row["can_delete"],
                )
            )

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
