"""Agent detail endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.schema import (DepartmentMapping, DepartmentMappingItem,
                              ModelMapping, ModelMappingItem, ReasoningMapping,
                              ReasoningMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class AgentDetailRequest(BaseModel):
    agentId: str
    profileId: str


# Inline schemas
class DebugInfoItem(BaseModel):
    """Debug information item."""

    created_at: str
    model_id: str
    content: str


class PromptInfo(BaseModel):
    """Prompt information for version history."""

    system_prompt: str
    created_at: str
    updated_at: str
    department_ids: list[str] | None
    can_delete: bool


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
    prompt_mapping: dict[str, PromptInfo]
    debug_info: list[DebugInfoItem]
    model_mapping: ModelMapping
    reasoning_mapping: ReasoningMapping


router = APIRouter()


@router.post("/detail", response_model=AgentDetailResponse)
async def get_agent_detail(
    request: AgentDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AgentDetailResponse:
    """Get agent detail with debug info and metadata."""
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
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        sql_query = load_sql("sql/v3/agents/get_agent_detail_complete.sql")
        sql_params = (request.agentId, request.profileId)
        result = await conn.fetchrow(sql_query, request.agentId, request.profileId)

        if not result:
            raise HTTPException(status_code=404, detail=f"Agent {request.agentId} not found")

        # Parse debug_info from JSONB
        debug_info: list[DebugInfoItem] = []
        debug_info_data = result["debug_info"]
        if isinstance(debug_info_data, str):
            debug_info_data = json.loads(debug_info_data)
        if debug_info_data and isinstance(debug_info_data, list):
            for item in debug_info_data:
                if isinstance(item, dict):
                    created_at_value = item.get("created_at")
                    debug_info.append(
                        DebugInfoItem(
                            created_at=created_at_value.isoformat() if created_at_value else "",
                            model_id=item.get("model_id", ""),
                            content=item.get("content", ""),
                        )
                    )

        # Parse model_mapping from JSONB
        model_mapping: ModelMapping = {}
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
        valid_model_ids: list[str] = []
        valid_model_ids_data = result["valid_model_ids"]
        if isinstance(valid_model_ids_data, str):
            valid_model_ids_data = json.loads(valid_model_ids_data)
        if valid_model_ids_data and isinstance(valid_model_ids_data, list):
            valid_model_ids = [str(mid) for mid in valid_model_ids_data if mid]

        # Parse department_ids from array
        department_ids_raw = result.get("department_ids")
        department_ids: list[str] = []
        if department_ids_raw and isinstance(department_ids_raw, (list, tuple)):
            department_ids = [str(did) for did in department_ids_raw if did]

        # Parse valid_department_ids from array
        valid_department_ids_raw = result.get("valid_department_ids")
        valid_department_ids: list[str] = []
        if valid_department_ids_raw and isinstance(valid_department_ids_raw, (list, tuple)):
            valid_department_ids = [str(did) for did in valid_department_ids_raw if did]

        # Parse department_mapping from JSONB
        department_mapping: DepartmentMapping = {}
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

        # Parse prompt_mapping from JSONB
        prompt_mapping: dict[str, PromptInfo] = {}
        prompt_mapping_data = result.get("prompt_mapping")
        if isinstance(prompt_mapping_data, str):
            prompt_mapping_data = json.loads(prompt_mapping_data)
        if prompt_mapping_data and isinstance(prompt_mapping_data, dict):
            for prompt_id, prompt_data in prompt_mapping_data.items():
                if isinstance(prompt_data, dict):
                    dept_ids = prompt_data.get("department_ids")
                    if isinstance(dept_ids, list):
                        dept_ids = [str(did) for did in dept_ids if did]
                    elif dept_ids is None:
                        dept_ids = None
                    prompt_mapping[prompt_id] = PromptInfo(
                        system_prompt=prompt_data.get("system_prompt", ""),
                        created_at=prompt_data.get("created_at", ""),
                        updated_at=prompt_data.get("updated_at", ""),
                        department_ids=dept_ids,
                        can_delete=prompt_data.get("can_delete", False),
                    )

        # Parse prompt_id
        prompt_id = result.get("prompt_id")
        if prompt_id:
            prompt_id = str(prompt_id)

        # Parse department_prompt_links from JSONB
        department_prompt_links: dict[str, str] = {}
        department_prompt_links_data = result.get("department_prompt_links")
        if isinstance(department_prompt_links_data, str):
            department_prompt_links_data = json.loads(department_prompt_links_data)
        if department_prompt_links_data and isinstance(department_prompt_links_data, dict):
            department_prompt_links = {
                str(dept_id): str(prompt_id)
                for dept_id, prompt_id in department_prompt_links_data.items()
            }

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
            name=result["name"],
            description=result["description"],
            system_prompt=result["system_prompt"],
            prompt_id=prompt_id,
            temperature=float(result["temperature"]) if result["temperature"] is not None else 0.0,
            model_id=result["model_id"],
            reasoning=result["reasoning"],
            active=result["active"],
            role=result.get("role", "assistant"),
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            department_prompt_links=department_prompt_links,
            prompt_mapping=prompt_mapping,
            valid_model_ids=valid_model_ids,
            reasoning_options=["none", "minimal", "low", "medium", "high"],
            temperature_lower=0.0,
            temperature_upper=1.0,
            debug_info=debug_info,
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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_agent_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

