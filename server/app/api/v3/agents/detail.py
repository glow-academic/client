"""Agent detail endpoint."""

import json
from datetime import datetime
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetAgentDetailApiRequest, GetAgentDetailApiResponse,
                           GetAgentDetailSqlParams, GetAgentDetailSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/get_agent_detail_complete.sql"


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
class AgentDetailRequest(BaseModel):
    agentId: str
    # profileId removed - comes from X-Profile-Id header


# Inline schemas
class DebugInfoItem(BaseModel):
    """Debug information item."""

    created_at: str
    model_id: str
    content: str


class PromptInfo(BaseModel):
    """Prompt information for version history."""

    system_prompt: str
    name: str
    description: str
    created_at: str
    updated_at: str
    department_ids: list[str] | None
    can_delete: bool


class AgentDetailResponse(BaseModel):
    name: str
    description: str
    system_prompt: str
    prompt_id: str | None
    temperature: float  # Selected temperature value (for backward compatibility)
    model_id: str
    reasoning: str | None  # Selected reasoning value (for backward compatibility)
    active: bool
    role: str
    selected_temperature_level_id: str | None
    selected_reasoning_level_id: str | None
    selected_voice_ids: list[str]
    valid_model_ids: list[str]
    reasoning_options: list[dict[str, str]]  # List of {id, reasoning_level} objects
    temperature_lower: float
    temperature_upper: float
    temperature_levels: list[
        dict[str, str | bool]
    ]  # List of {id, temperature, is_upper} objects
    valid_voices: list[str]  # Selected voice names (for backward compatibility)
    available_voices: list[dict[str, str]]  # List of {id, voice} objects
    department_ids: list[str]
    valid_department_ids: list[str]
    department_mapping: DepartmentMapping
    department_prompt_links: dict[str, str]
    prompt_mapping: dict[str, PromptInfo]
    debug_info: list[DebugInfoItem]
    model_mapping: ModelMapping
    reasoning_mapping: ReasoningMapping
    can_edit: bool


router = APIRouter()


@router.post(
    "/detail",
    response_model=AgentDetailResponse,
    dependencies=[
        audit_activity(
            "agent.viewed", "{{ actor.name }} viewed agent '{{ agent.name }}'"
        )
    ],
)
async def get_agent_detail(
    request: GetAgentDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> AgentDetailResponse:
    """Get agent detail with debug info and metadata."""
    tags = ["agents"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return AgentDetailResponse.model_validate(cached["data"])

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
        params = GetAgentDetailSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            GetAgentDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
                list_prefixes={"model_mapping", "department_mapping"},
            ),
        )

        # Check if result is empty (no access or not found)
        result_dict = result.model_dump()
        if not result_dict.get("agent_id"):
            # Check if agent exists but user doesn't have department access
            agent_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM agents WHERE id = $1)",
                request.agent_id,
            )
            if agent_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this agent. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Agent {request.agent_id} not found"
            )

        # Parse debug_info from JSONB (result is typed, but JSONB fields need parsing)
        debug_info: list[DebugInfoItem] = []
        debug_info_data = result_dict.get("debug_info")
        if isinstance(debug_info_data, str):
            debug_info_data = json.loads(debug_info_data)
        if debug_info_data and isinstance(debug_info_data, list):
            for item in debug_info_data:
                if isinstance(item, dict):
                    created_at_value = item.get("created_at")
                    if created_at_value:
                        if isinstance(created_at_value, str):
                            created_at_str = created_at_value
                        elif isinstance(created_at_value, datetime):
                            created_at_str = created_at_value.isoformat()
                        else:
                            created_at_str = str(created_at_value)
                    else:
                        created_at_str = ""
                    debug_info.append(
                        DebugInfoItem(
                            created_at=created_at_str,
                            model_id=item.get("model_id", ""),
                            content=item.get("content", ""),
                        )
                    )

        # Parse model_mapping from JSONB (with modalities)
        # Store raw model_mapping_data with modalities for response
        model_mapping: ModelMapping = {}
        model_mapping_with_modalities: dict[str, dict[str, Any]] = {}
        model_mapping_data = result_dict.get("model_mapping")
        if isinstance(model_mapping_data, str):
            model_mapping_data = json.loads(model_mapping_data)

        # Debug: Log first model's keys to see what SQL returns
        if (
            model_mapping_data
            and isinstance(model_mapping_data, dict)
            and len(model_mapping_data) > 0
        ):
            first_model_id = next(iter(model_mapping_data.keys()))
            first_model_data = model_mapping_data[first_model_id]
            import logging

            logger = logging.getLogger(__name__)
            logger.warning(
                f"DEBUG: First model {first_model_id} keys: {list(first_model_data.keys()) if isinstance(first_model_data, dict) else 'not dict'}"
            )
            logger.warning(
                f"DEBUG: First model has modalities: {'modalities' in first_model_data if isinstance(first_model_data, dict) else False}"
            )
            logger.warning(
                f"DEBUG: First model has temperature_lower: {'temperature_lower' in first_model_data if isinstance(first_model_data, dict) else False}"
            )

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

                    # Create ModelMappingItem for typed response (with optional fields)
                    model_mapping[model_id] = ModelMappingItem(
                        name=model_data.get("name", ""),
                        description=model_data.get("description", ""),
                        input_modalities=modalities_dict["input"]
                        if modalities_dict["input"]
                        else None,
                        output_modalities=modalities_dict["output"]
                        if modalities_dict["output"]
                        else None,
                        temperature_lower=float(
                            model_data.get("temperature_lower", 0.0)
                        )
                        if model_data.get("temperature_lower") is not None
                        else None,
                        temperature_upper=float(
                            model_data.get("temperature_upper", 1.0)
                        )
                        if model_data.get("temperature_upper") is not None
                        else None,
                        temperature_levels=temperature_levels_data
                        if temperature_levels_data
                        else None,
                        reasoning_options=reasoning_options_data
                        if reasoning_options_data
                        else None,
                        available_voices=available_voices_data
                        if available_voices_data
                        else None,
                    )
                    # Store full data with modalities, temperature_levels, and reasoning_options for response
                    # (Note: model_mapping_with_modalities is no longer needed since ModelMappingItem includes all fields)

        # Parse valid_model_ids from JSONB
        valid_model_ids: list[str] = []
        valid_model_ids_data = result_dict.get("valid_model_ids")
        if isinstance(valid_model_ids_data, str):
            valid_model_ids_data = json.loads(valid_model_ids_data)
        if valid_model_ids_data and isinstance(valid_model_ids_data, list):
            valid_model_ids = [str(mid) for mid in valid_model_ids_data if mid]

        # Parse department_ids from array
        department_ids_raw = result_dict.get("department_ids")
        department_ids: list[str] = []
        if department_ids_raw and isinstance(department_ids_raw, (list, tuple)):
            department_ids = [str(did) for did in department_ids_raw if did]

        # Parse valid_department_ids from array
        valid_department_ids_raw = result_dict.get("valid_department_ids")
        valid_department_ids: list[str] = []
        if valid_department_ids_raw and isinstance(
            valid_department_ids_raw, (list, tuple)
        ):
            valid_department_ids = [str(did) for did in valid_department_ids_raw if did]

        # Parse department_mapping from JSONB
        department_mapping: DepartmentMapping = {}
        department_mapping_data = result_dict.get("department_mapping")
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
        prompt_mapping_data = result_dict.get("prompt_mapping")
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
                        name=prompt_data.get("name", ""),
                        description=prompt_data.get("description", ""),
                        created_at=prompt_data.get("created_at", ""),
                        updated_at=prompt_data.get("updated_at", ""),
                        department_ids=dept_ids,
                        can_delete=prompt_data.get("can_delete", False),
                    )

        # Parse prompt_id
        prompt_id = result_dict.get("prompt_id")
        if prompt_id:
            prompt_id = str(prompt_id)

        # Parse department_prompt_links from JSONB
        department_prompt_links: dict[str, str] = {}
        department_prompt_links_data = result_dict.get("department_prompt_links")
        if isinstance(department_prompt_links_data, str):
            department_prompt_links_data = json.loads(department_prompt_links_data)
        if department_prompt_links_data and isinstance(
            department_prompt_links_data, dict
        ):
            department_prompt_links = {
                str(dept_id): str(prompt_id)
                for dept_id, prompt_id in department_prompt_links_data.items()
            }

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

        # Parse reasoning_options from JSONB (list of {id, reasoning_level} objects)
        reasoning_options: list[dict[str, str]] = []
        reasoning_options_data = result_dict.get("reasoning_options")
        if isinstance(reasoning_options_data, str):
            reasoning_options_data = json.loads(reasoning_options_data)
        if reasoning_options_data and isinstance(reasoning_options_data, list):
            reasoning_options = [
                opt
                if isinstance(opt, dict)
                else {"id": "", "reasoning_level": str(opt)}
                for opt in reasoning_options_data
                if opt
            ]

        # Parse temperature_levels from JSONB (list of {id, temperature, is_upper} objects)
        temperature_levels: list[dict[str, str | bool]] = []
        temperature_levels_data = result_dict.get("temperature_levels")
        if isinstance(temperature_levels_data, str):
            temperature_levels_data = json.loads(temperature_levels_data)
        if temperature_levels_data and isinstance(temperature_levels_data, list):
            temperature_levels = [
                level
                if isinstance(level, dict)
                else {"id": "", "temperature": str(level), "is_upper": False}
                for level in temperature_levels_data
                if level
            ]

        # Parse selected_voice_ids from JSONB
        selected_voice_ids: list[str] = []
        selected_voice_ids_data = result_dict.get("selected_voice_ids")
        if isinstance(selected_voice_ids_data, str):
            selected_voice_ids_data = json.loads(selected_voice_ids_data)
        if selected_voice_ids_data and isinstance(selected_voice_ids_data, list):
            selected_voice_ids = [
                str(voice_id) for voice_id in selected_voice_ids_data if voice_id
            ]

        # Parse valid_voices from JSONB (selected voice names for backward compatibility)
        valid_voices: list[str] = []
        valid_voices_data = result_dict.get("valid_voices")
        if isinstance(valid_voices_data, str):
            valid_voices_data = json.loads(valid_voices_data)
        if valid_voices_data and isinstance(valid_voices_data, list):
            valid_voices = [str(voice) for voice in valid_voices_data if voice]

        # Parse available_voices from JSONB (list of {id, voice} objects)
        available_voices: list[dict[str, str]] = []
        available_voices_data = result_dict.get("available_voices")
        if isinstance(available_voices_data, str):
            available_voices_data = json.loads(available_voices_data)
        if available_voices_data and isinstance(available_voices_data, list):
            available_voices = [
                voice if isinstance(voice, dict) else {"id": "", "voice": str(voice)}
                for voice in available_voices_data
                if voice
            ]

        # Get can_edit from SQL result
        can_edit = result_dict.get("can_edit", False)

        # Set audit context with data from SQL query
        actor_name = result_dict.get("actor_name")
        agent_name = result_dict.get("name")
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                agent={"name": agent_name, "id": str(request.agent_id)},
            )

        response_data = AgentDetailResponse(
            name=result_dict["name"],
            description=result_dict["description"],
            system_prompt=result_dict["system_prompt"],
            prompt_id=prompt_id,
            temperature=float(result_dict.get("temperature", 0.0)),
            model_id=result_dict["model_id"],
            reasoning=result_dict.get("reasoning"),
            active=result_dict["active"],
            role=result_dict["role"],
            selected_temperature_level_id=result_dict.get("selected_temperature_level_id"),
            selected_reasoning_level_id=result_dict.get("selected_reasoning_level_id"),
            selected_voice_ids=selected_voice_ids,
            department_ids=department_ids,
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
            department_prompt_links=department_prompt_links,
            prompt_mapping=prompt_mapping,
            valid_model_ids=valid_model_ids,
            reasoning_options=reasoning_options if reasoning_options else [],
            temperature_lower=float(result_dict.get("temperature_lower", 0.0)),
            temperature_upper=float(result_dict.get("temperature_upper", 1.0)),
            temperature_levels=temperature_levels,
            valid_voices=valid_voices,
            available_voices=available_voices,
            debug_info=debug_info,
            model_mapping=model_mapping,
            reasoning_mapping=reasoning_mapping,
            can_edit=can_edit,
        )

        # Cache response (model_mapping now includes all fields via ModelMappingItem)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        # Return response (model_mapping already includes modalities and options via ModelMappingItem)
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
