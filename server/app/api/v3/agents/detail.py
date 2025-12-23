"""Agent detail endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetAgentDetailApiRequest, GetAgentDetailSqlParams,
                           GetAgentDetailSqlRow, load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/get_agent_detail_complete.sql"


# Response model matching actual API structure (dicts for mappings)
# TODO: Update SQL type generation to support dict outputs, then use GetAgentDetailApiResponse
class ReasoningMappingItem(BaseModel):
    """Reasoning mapping item."""

    name: str
    description: str


ReasoningMapping = dict[str, ReasoningMappingItem]


class AgentDetailResponse(BaseModel):
    """API response for agent detail."""
    name: str
    description: str
    system_prompt: str
    prompt_id: str | None
    temperature: float
    model_id: str
    reasoning: str | None
    active: bool
    role: str
    selected_temperature_level_id: str | None
    selected_reasoning_level_id: str | None
    selected_voice_ids: list[str]
    valid_model_ids: list[str]
    reasoning_options: list[dict[str, str]]
    temperature_lower: float
    temperature_upper: float
    temperature_levels: list[dict[str, str | bool]]
    valid_voices: list[str]
    available_voices: list[dict[str, str]]
    department_ids: list[str]
    valid_department_ids: list[str]
    department_mapping: dict[str, dict[str, str]]
    department_prompt_links: dict[str, str]
    prompt_mapping: dict[str, dict[str, Any]]
    debug_info: list[dict[str, str]]
    model_mapping: dict[str, dict[str, Any]]
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
        # Use dict_prefixes to convert lists to dicts for mappings
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
                dict_prefixes={
                    "model_mapping": "id",
                    "department_mapping": "id",
                    "prompt_mapping": "id",
                    "department_prompt_links": "department_id",
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

        # Convert dict mappings to expected format
        # result.model_mapping, result.department_mapping, etc. are now dicts (from dict_prefixes)
        model_mapping_dict: dict[str, dict[str, Any]] = {}
        if isinstance(result_dict.get("model_mapping"), dict):
            for model_id, model_item in result_dict["model_mapping"].items():
                if isinstance(model_item, dict):
                    model_mapping_dict[str(model_id)] = model_item

        department_mapping_dict: dict[str, dict[str, str]] = {}
        if isinstance(result_dict.get("department_mapping"), dict):
            for dept_id, dept_item in result_dict["department_mapping"].items():
                if isinstance(dept_item, dict):
                    department_mapping_dict[str(dept_id)] = {
                        "name": dept_item.get("name", ""),
                        "description": dept_item.get("description", ""),
                    }

        prompt_mapping_dict: dict[str, dict[str, Any]] = {}
        if isinstance(result_dict.get("prompt_mapping"), dict):
            for prompt_id, prompt_item in result_dict["prompt_mapping"].items():
                if isinstance(prompt_item, dict):
                    # Ensure timestamps are strings and department_ids is list[str] | None
                    prompt_dict = dict(prompt_item)
                    if "created_at" in prompt_dict and not isinstance(prompt_dict["created_at"], str):
                        prompt_dict["created_at"] = str(prompt_dict["created_at"])
                    if "updated_at" in prompt_dict and not isinstance(prompt_dict["updated_at"], str):
                        prompt_dict["updated_at"] = str(prompt_dict["updated_at"])
                    if "department_ids" in prompt_dict and prompt_dict["department_ids"]:
                        if isinstance(prompt_dict["department_ids"], list):
                            prompt_dict["department_ids"] = [str(did) for did in prompt_dict["department_ids"]]
                    prompt_mapping_dict[str(prompt_id)] = prompt_dict

        department_prompt_links_dict: dict[str, str] = {}
        if isinstance(result_dict.get("department_prompt_links"), dict):
            for dept_id, link_item in result_dict["department_prompt_links"].items():
                if isinstance(link_item, dict):
                    prompt_id_val = link_item.get("prompt_id")
                    if prompt_id_val:
                        department_prompt_links_dict[str(dept_id)] = str(prompt_id_val)

        # Build reasoning_mapping (constant, not from SQL)
        reasoning_mapping: ReasoningMapping = {
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

        # Convert lists to expected format (these remain as lists)
        debug_info_list = result_dict.get("debug_info", [])
        debug_info: list[dict[str, str]] = []
        if isinstance(debug_info_list, list):
            for item in debug_info_list:
                if isinstance(item, dict):
                    debug_info.append({
                        "created_at": str(item.get("created_at", "")),
                        "model_id": str(item.get("model_id", "")),
                        "content": str(item.get("content", "")),
                    })

        reasoning_options_list = result_dict.get("reasoning_options", [])
        reasoning_options: list[dict[str, str]] = []
        if isinstance(reasoning_options_list, list):
            for opt in reasoning_options_list:
                if isinstance(opt, dict):
                    reasoning_options.append({
                        "id": str(opt.get("id", "")),
                        "reasoning_level": str(opt.get("reasoning_level", "")),
                    })

        temperature_levels_list = result_dict.get("temperature_levels", [])
        temperature_levels: list[dict[str, str | bool]] = []
        if isinstance(temperature_levels_list, list):
            for level in temperature_levels_list:
                if isinstance(level, dict):
                    temperature_levels.append({
                        "id": str(level.get("id", "")),
                        "temperature": str(level.get("temperature", "")),
                        "is_upper": bool(level.get("is_upper", False)),
                    })

        available_voices_list = result_dict.get("available_voices", [])
        available_voices: list[dict[str, str]] = []
        if isinstance(available_voices_list, list):
            for voice in available_voices_list:
                if isinstance(voice, dict):
                    available_voices.append({
                        "id": str(voice.get("id", "")),
                        "voice": str(voice.get("voice", "")),
                    })

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                agent={"name": result.name, "id": str(request.agent_id)},
            )

        # Convert SQL result to API response
        response_data = AgentDetailResponse(
            name=result.name,
            description=result.description,
            system_prompt=result.system_prompt,
            prompt_id=result.prompt_id if result.prompt_id else None,
            temperature=result.temperature,
            model_id=result.model_id,
            reasoning=result.reasoning if result.reasoning else None,
            active=result.active,
            role=result.role,
            selected_temperature_level_id=result.selected_temperature_level_id if result.selected_temperature_level_id else None,
            selected_reasoning_level_id=result.selected_reasoning_level_id if result.selected_reasoning_level_id else None,
            selected_voice_ids=result.selected_voice_ids,
            department_ids=result.department_ids,
            valid_department_ids=result.valid_department_ids,
            department_mapping=department_mapping_dict,
            department_prompt_links=department_prompt_links_dict,
            prompt_mapping=prompt_mapping_dict,
            valid_model_ids=result.valid_model_ids,
            reasoning_options=reasoning_options,
            temperature_lower=result.temperature_lower,
            temperature_upper=result.temperature_upper,
            temperature_levels=temperature_levels,
            valid_voices=result.valid_voices,
            available_voices=available_voices,
            debug_info=debug_info,
            model_mapping=model_mapping_dict,
            reasoning_mapping=reasoning_mapping,
            can_edit=result.can_edit,
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
