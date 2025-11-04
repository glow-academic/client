"""Agent list endpoint."""

import json
from typing import Annotated

import asyncpg
from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (DepartmentMapping, DepartmentMappingItem,
                              ModelMapping, ModelMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class AgentsListRequest(BaseModel):
    profileId: str


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


@router.post("/list", response_model=AgentsListResponse)
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
    
    try:
        # Load SQL string
        sql = load_sql("sql/v3/agents/get_agents_list_complete.sql")
        
        # Execute query
        rows = await conn.fetch(sql, request.profileId)
        
        # Build model mapping and department mapping from the single result set
        model_mapping: ModelMapping = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}
        agents: list[AgentItem] = []
        
        for row in rows:
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
            
            # Parse department_mapping from first row (same for all agents)
            if not department_mapping and row.get("department_mapping"):
                dm = row["department_mapping"]
                if isinstance(dm, str):
                    dm = json.loads(dm)
                if isinstance(dm, dict):
                    for did, ddata in dm.items():
                        if isinstance(ddata, dict):
                            department_mapping[did] = DepartmentMappingItem(
                                name=ddata["name"], description=ddata["description"]
                            )
            
            # Format updated_at
            updated_at = row["updated_at"]
            if hasattr(updated_at, "isoformat"):
                updated_at = updated_at.isoformat()
            elif not isinstance(updated_at, str):
                updated_at = str(updated_at)
            
            agents.append(
                AgentItem(
                    agent_id=row["agent_id"],
                    name=row["name"],
                    description=row["description"],
                    reasoning=row["reasoning"],
                    temperature=float(row["temperature"]) if row["temperature"] is not None else 0.0,
                    model_id=row["model_id"],
                    role=row.get("role", "assistant"),
                    department_ids=dept_ids,
                    updated_at=updated_at,
                    can_edit=row["can_edit"],
                    can_duplicate=row["can_duplicate"],
                    can_delete=row["can_delete"],
                )
            )
        
        response_data = AgentsListResponse(
            agents=agents,
            model_mapping=model_mapping,
            department_mapping=department_mapping,
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

