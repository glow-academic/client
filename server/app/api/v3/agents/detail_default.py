"""Agent new endpoint."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class ModelMappingItem(BaseModel):
    """Model mapping item."""

    name: str
    description: str
    # Optional fields that may be present in model_mapping
    input_modalities: list[str] | None = None
    output_modalities: list[str] | None = None
    temperature_lower: float | None = None
    temperature_upper: float | None = None
    temperature_levels: list[dict[str, str | bool]] | None = None
    reasoning_options: list[dict[str, str]] | None = None
    available_voices: list[dict[str, str]] | None = None  # List of {id, voice} objects


class ReasoningMappingItem(BaseModel):
    """Reasoning mapping item."""

    name: str
    description: str


# Type aliases for Dict mappings
DepartmentMapping = dict[str, DepartmentMappingItem]
ModelMapping = dict[str, ModelMappingItem]
ReasoningMapping = dict[str, ReasoningMappingItem]


# Inline request/response schemas
class AgentNewRequest(BaseModel):
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
    temperature_values: list[str]
    valid_voices: list[str]
    department_ids: list[str]
    valid_department_ids: list[str]
    department_mapping: DepartmentMapping
    department_prompt_links: dict[str, str]
    prompt_mapping: dict[str, dict[str, Any]]
    debug_info: list[dict[str, Any]]
    model_mapping: ModelMapping
    reasoning_mapping: ReasoningMapping
    can_edit: bool


router = APIRouter()


@router.post("/new", response_model=AgentDetailResponse)
async def get_agent_new(
    request: AgentNewRequest,
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

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/agents/get_agent_new_complete.sql")
        sql_params = (request.profileId,)
        result = await conn.fetchrow(sql_query, request.profileId)

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
                        # Parse modalities
                        modalities_data = model_data.get("modalities")
                        modalities_dict: dict[str, list[str]] = {"input": [], "output": []}
                        if modalities_data:
                            if isinstance(modalities_data, str):
                                modalities_data = json.loads(modalities_data)
                            if isinstance(modalities_data, dict):
                                input_mods = modalities_data.get("input", [])
                                output_mods = modalities_data.get("output", [])
                                if isinstance(input_mods, str):
                                    input_mods = json.loads(input_mods)
                                if isinstance(output_mods, str):
                                    output_mods = json.loads(output_mods)
                                modalities_dict = {
                                    "input": [str(m) for m in input_mods]
                                    if isinstance(input_mods, list)
                                    else [],
                                    "output": [str(m) for m in output_mods]
                                    if isinstance(output_mods, list)
                                    else [],
                                }
                        
                        # Parse temperature_levels and reasoning_options
                        temperature_levels_data = model_data.get("temperature_levels", [])
                        if isinstance(temperature_levels_data, str):
                            temperature_levels_data = json.loads(temperature_levels_data)
                        if not isinstance(temperature_levels_data, list):
                            temperature_levels_data = []
                        
                        reasoning_options_data = model_data.get("reasoning_options", [])
                        if isinstance(reasoning_options_data, str):
                            reasoning_options_data = json.loads(reasoning_options_data)
                        if not isinstance(reasoning_options_data, list):
                            reasoning_options_data = []
                        
                        # Parse available_voices
                        available_voices_data = model_data.get("available_voices", [])
                        if isinstance(available_voices_data, str):
                            available_voices_data = json.loads(available_voices_data)
                        if not isinstance(available_voices_data, list):
                            available_voices_data = []
                        
                        model_mapping[model_id] = ModelMappingItem(
                            name=model_data.get("name", ""),
                            description=model_data.get("description", ""),
                            input_modalities=modalities_dict["input"] if modalities_dict["input"] else None,
                            output_modalities=modalities_dict["output"] if modalities_dict["output"] else None,
                            temperature_lower=float(model_data.get("temperature_lower", 0.0)) if model_data.get("temperature_lower") is not None else None,
                            temperature_upper=float(model_data.get("temperature_upper", 1.0)) if model_data.get("temperature_upper") is not None else None,
                            temperature_levels=temperature_levels_data if temperature_levels_data else None,
                            reasoning_options=reasoning_options_data if reasoning_options_data else None,
                            available_voices=available_voices_data if available_voices_data else None,
                        )

            # Parse valid_model_ids from JSONB
            valid_model_ids_data = result["valid_model_ids"]
            if isinstance(valid_model_ids_data, str):
                valid_model_ids_data = json.loads(valid_model_ids_data)
            if valid_model_ids_data and isinstance(valid_model_ids_data, list):
                valid_model_ids = [str(mid) for mid in valid_model_ids_data if mid]

            # Parse valid_department_ids from array
            valid_department_ids_raw = result.get("valid_department_ids")
            if valid_department_ids_raw and isinstance(
                valid_department_ids_raw, (list, tuple)
            ):
                valid_department_ids = [
                    str(did) for did in valid_department_ids_raw if did
                ]

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
            "none": ReasoningMappingItem(
                name="None", description="No extended reasoning"
            ),
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
                name="High",
                description="Deep reasoning for complex, multi-step problems",
            ),
        }

        # Get user role and primary department for default behavior
        user_role = result.get("user_role", "trainee") if result else "trainee"
        is_superadmin = user_role == "superadmin"
        primary_department_id = result.get("primary_department_id") if result else None

        # Set default department_ids based on role
        # Superadmin: [] (empty = all departments = default object)
        # Non-superadmin: [primaryDepartmentId] if available
        if is_superadmin:
            default_department_ids: list[str] = []
        else:
            default_department_ids = (
                [primary_department_id] if primary_department_id else []
            )

        # Default agents (no department_ids) are read-only for non-superadmin
        can_edit = is_superadmin

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
            department_ids=default_department_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            department_prompt_links={},
            prompt_mapping={},
            valid_model_ids=valid_model_ids,
            reasoning_options=["none", "minimal", "low", "medium", "high"],
            temperature_lower=0.0,
            temperature_upper=1.0,
            temperature_values=[],
            valid_voices=[],
            debug_info=[],
            model_mapping=model_mapping,
            reasoning_mapping=reasoning_mapping,
            can_edit=can_edit,
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
            operation="get_agent_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
