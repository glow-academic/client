"""Agent detail default endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (DepartmentMapping, DepartmentMappingItem,
                              ModelMapping, ModelMappingItem, ReasoningMapping,
                              ReasoningMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class AgentDetailDefaultRequest(BaseModel):
    profileId: str


class AgentDetailResponse(BaseModel):
    name: str
    description: str
    system_prompt: str
    prompt_id: str | None
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool
    role: str
    valid_model_ids: list[str]
    reasoning_options: list[str]
    temperature_lower: float
    temperature_upper: float
    department_ids: list[str]
    valid_department_ids: list[str]
    department_mapping: DepartmentMapping
    department_prompt_links: dict[str, str]
    prompt_mapping: dict[str, dict[str, Any]]
    debug_info: list[dict[str, Any]]
    model_mapping: ModelMapping
    reasoning_mapping: ReasoningMapping


router = APIRouter()


@router.post("/detail-default", response_model=AgentDetailResponse)
async def get_agent_detail_default(
    request: AgentDetailDefaultRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AgentDetailResponse:
    """Get default agent detail metadata for creating new agents."""
    tags = ["agents"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return AgentDetailResponse.model_validate(cached["data"])
    
    try:
        sql = load_sql("sql/v3/agents/get_agent_detail_default_complete.sql")
        result = await conn.fetchrow(sql, request.profileId)

        # Initialize defaults
        model_mapping: ModelMapping = {}
        valid_model_ids: list[str] = []
        department_mapping: DepartmentMapping = {}
        valid_department_ids: list[str] = []

        if result:
            # Parse model_mapping from JSONB
            model_mapping_data = result["model_mapping"]
            if isinstance(model_mapping_data, str):
                model_mapping_data = json.loads(model_mapping_data)
            if model_mapping_data and isinstance(model_mapping_data, dict):
                for model_id, model_data in model_mapping_data.items():
                    if isinstance(model_data, dict):
                        model_mapping[model_id] = ModelMappingItem(
                            name=model_data.get("name", ""),
                            description=model_data.get("description", ""),
                        )

            # Parse valid_model_ids from JSONB
            valid_model_ids_data = result["valid_model_ids"]
            if isinstance(valid_model_ids_data, str):
                valid_model_ids_data = json.loads(valid_model_ids_data)
            if valid_model_ids_data and isinstance(valid_model_ids_data, list):
                valid_model_ids = [str(mid) for mid in valid_model_ids_data if mid]

            # Parse valid_department_ids from array
            valid_department_ids_raw = result.get("valid_department_ids")
            if valid_department_ids_raw and isinstance(valid_department_ids_raw, (list, tuple)):
                valid_department_ids = [str(did) for did in valid_department_ids_raw if did]

            # Parse department_mapping from JSONB
            department_mapping_data = result.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for dept_id, dept_data in department_mapping_data.items():
                    if isinstance(dept_data, dict):
                        department_mapping[dept_id] = DepartmentMappingItem(
                            name=dept_data.get("name", ""),
                            description=dept_data.get("description", ""),
                        )

        # Build reasoning_mapping
        reasoning_mapping = {
            "none": ReasoningMappingItem(name="None", description="No extended reasoning"),
            "minimal": ReasoningMappingItem(
                name="Minimal", description="Basic reasoning for straightforward tasks"
            ),
            "low": ReasoningMappingItem(
                name="Low", description="Light reasoning for simple problem-solving"
            ),
            "medium": ReasoningMappingItem(
                name="Medium", description="Balanced reasoning for moderate complexity"
            ),
            "high": ReasoningMappingItem(
                name="High", description="Deep reasoning for complex, multi-step problems"
            ),
        }

        response_data = AgentDetailResponse(
            name="",
            description="",
            system_prompt="",
            prompt_id=None,
            temperature=0.7,
            model_id="",
            reasoning="none",
            active=True,
            role="assistant",
            department_ids=[],
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            department_prompt_links={},
            prompt_mapping={},
            valid_model_ids=valid_model_ids,
            reasoning_options=["none", "minimal", "low", "medium", "high"],
            temperature_lower=0.0,
            temperature_upper=1.0,
            debug_info=[],
            model_mapping=model_mapping,
            reasoning_mapping=reasoning_mapping,
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

