"""Agent detail endpoint."""

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
                list_prefixes={
                    "model_mapping",
                    "department_mapping",
                    "prompt_mapping",
                    "department_prompt_links",
                    "debug_info",
                    "reasoning_options",
                    "temperature_levels",
                    "available_voices",
                },
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

        # Parse debug_info from nested list (nest_many returns list)
        debug_info: list[DebugInfoItem] = []
        debug_info_list = result_dict.get("debug_info", [])
        if isinstance(debug_info_list, list):
            for item in debug_info_list:
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

        # Parse model_mapping from nested list (nest_many returns list)
        # Convert list to dict keyed by model_id
        model_mapping: ModelMapping = {}
        model_mapping_list = result_dict.get("model_mapping", [])
        if isinstance(model_mapping_list, list):
            for model_data in model_mapping_list:
                if isinstance(model_data, dict):
                    model_id = model_data.get("id")
                    if model_id:
                        # Get nested lists for temperature_levels, reasoning_options, available_voices
                        temperature_levels_list = model_data.get("temperature_levels", [])
                        reasoning_options_list = model_data.get("reasoning_options", [])
                        available_voices_list = model_data.get("available_voices", [])
                        
                        # Convert nested lists to expected format
                        temperature_levels_formatted = []
                        if isinstance(temperature_levels_list, list):
                            for level in temperature_levels_list:
                                if isinstance(level, dict):
                                    temperature_levels_formatted.append({
                                        "id": level.get("id", ""),
                                        "temperature": level.get("temperature", ""),
                                        "is_upper": level.get("is_upper", False),
                                    })
                        
                        reasoning_options_formatted = []
                        if isinstance(reasoning_options_list, list):
                            for opt in reasoning_options_list:
                                if isinstance(opt, dict):
                                    reasoning_options_formatted.append({
                                        "id": opt.get("id", ""),
                                        "reasoning_level": opt.get("reasoning_level", ""),
                                    })
                        
                        available_voices_formatted = []
                        if isinstance(available_voices_list, list):
                            for voice in available_voices_list:
                                if isinstance(voice, dict):
                                    available_voices_formatted.append({
                                        "id": voice.get("id", ""),
                                        "voice": voice.get("voice", ""),
                                    })
                        
                        model_mapping[str(model_id)] = ModelMappingItem(
                            name=model_data.get("name", ""),
                            description=model_data.get("description", ""),
                            input_modalities=model_data.get("input_modalities") or None,
                            output_modalities=model_data.get("output_modalities") or None,
                            temperature_lower=float(model_data.get("temperature_lower", 0.0)) if model_data.get("temperature_lower") is not None else None,
                            temperature_upper=float(model_data.get("temperature_upper", 1.0)) if model_data.get("temperature_upper") is not None else None,
                            temperature_levels=temperature_levels_formatted if temperature_levels_formatted else None,
                            reasoning_options=reasoning_options_formatted if reasoning_options_formatted else None,
                            available_voices=available_voices_formatted if available_voices_formatted else None,
                        )

        # Parse valid_model_ids from array (already an array from SQL)
        valid_model_ids: list[str] = []
        valid_model_ids_data = result_dict.get("valid_model_ids")
        if isinstance(valid_model_ids_data, list):
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

        # Parse department_mapping from nested list (nest_many returns list)
        # Convert list to dict keyed by department_id
        department_mapping: DepartmentMapping = {}
        department_mapping_list = result_dict.get("department_mapping", [])
        if isinstance(department_mapping_list, list):
            for dept_data in department_mapping_list:
                if isinstance(dept_data, dict):
                    dept_id = dept_data.get("id")
                    if dept_id:
                        department_mapping[str(dept_id)] = DepartmentMappingItem(
                            name=dept_data.get("name", ""),
                            description=dept_data.get("description", ""),
                        )

        # Parse prompt_mapping from nested list (nest_many returns list)
        # Convert list to dict keyed by prompt_id
        prompt_mapping: dict[str, PromptInfo] = {}
        prompt_mapping_list = result_dict.get("prompt_mapping", [])
        if isinstance(prompt_mapping_list, list):
            for prompt_data in prompt_mapping_list:
                if isinstance(prompt_data, dict):
                    prompt_id = prompt_data.get("id")
                    if prompt_id:
                        dept_ids = prompt_data.get("department_ids")
                        if isinstance(dept_ids, list):
                            dept_ids = [str(did) for did in dept_ids if did]
                        elif dept_ids is None:
                            dept_ids = None
                        
                        # Format timestamps
                        created_at = prompt_data.get("created_at")
                        if created_at and hasattr(created_at, "isoformat"):
                            created_at = created_at.isoformat()
                        elif created_at and not isinstance(created_at, str):
                            created_at = str(created_at)
                        else:
                            created_at = created_at or ""
                        
                        updated_at = prompt_data.get("updated_at")
                        if updated_at and hasattr(updated_at, "isoformat"):
                            updated_at = updated_at.isoformat()
                        elif updated_at and not isinstance(updated_at, str):
                            updated_at = str(updated_at)
                        else:
                            updated_at = updated_at or ""
                        
                        prompt_mapping[str(prompt_id)] = PromptInfo(
                            system_prompt=prompt_data.get("system_prompt", ""),
                            name=prompt_data.get("name", ""),
                            description=prompt_data.get("description", ""),
                            created_at=created_at,
                            updated_at=updated_at,
                            department_ids=dept_ids,
                            can_delete=prompt_data.get("can_delete", False),
                        )

        # Parse prompt_id
        prompt_id = result_dict.get("prompt_id")
        if prompt_id:
            prompt_id = str(prompt_id)

        # Parse department_prompt_links from nested list (nest_many returns list)
        # Convert list to dict keyed by department_id
        department_prompt_links: dict[str, str] = {}
        department_prompt_links_list = result_dict.get("department_prompt_links", [])
        if isinstance(department_prompt_links_list, list):
            for link_data in department_prompt_links_list:
                if isinstance(link_data, dict):
                    dept_id = link_data.get("department_id")
                    prompt_id = link_data.get("prompt_id")
                    if dept_id and prompt_id:
                        department_prompt_links[str(dept_id)] = str(prompt_id)

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

        # Parse reasoning_options from nested list (nest_many returns list)
        reasoning_options: list[dict[str, str]] = []
        reasoning_options_list = result_dict.get("reasoning_options", [])
        if isinstance(reasoning_options_list, list):
            for opt in reasoning_options_list:
                if isinstance(opt, dict):
                    reasoning_options.append({
                        "id": opt.get("id", ""),
                        "reasoning_level": opt.get("reasoning_level", ""),
                    })

        # Parse temperature_levels from nested list (nest_many returns list)
        temperature_levels: list[dict[str, str | bool]] = []
        temperature_levels_list = result_dict.get("temperature_levels", [])
        if isinstance(temperature_levels_list, list):
            for level in temperature_levels_list:
                if isinstance(level, dict):
                    temperature_levels.append({
                        "id": level.get("id", ""),
                        "temperature": level.get("temperature", ""),
                        "is_upper": level.get("is_upper", False),
                    })

        # Parse selected_voice_ids from array (already an array from SQL)
        selected_voice_ids: list[str] = []
        selected_voice_ids_data = result_dict.get("selected_voice_ids")
        if isinstance(selected_voice_ids_data, list):
            selected_voice_ids = [str(voice_id) for voice_id in selected_voice_ids_data if voice_id]

        # Parse valid_voices from array (already an array from SQL)
        valid_voices: list[str] = []
        valid_voices_data = result_dict.get("valid_voices")
        if isinstance(valid_voices_data, list):
            valid_voices = [str(voice) for voice in valid_voices_data if voice]

        # Parse available_voices from nested list (nest_many returns list)
        available_voices: list[dict[str, str]] = []
        available_voices_list = result_dict.get("available_voices", [])
        if isinstance(available_voices_list, list):
            for voice in available_voices_list:
                if isinstance(voice, dict):
                    available_voices.append({
                        "id": voice.get("id", ""),
                        "voice": voice.get("voice", ""),
                    })

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
