"""Agent new endpoint."""

from typing import TYPE_CHECKING, Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.types.registry import load_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql
from utils.sql_nest import nest_many

if TYPE_CHECKING:
    from app.types.v3.agents.get_agent_new_complete import (
        GetAgentNewSqlParams, GetAgentNewSqlRow)


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
    pass
    # profileId removed - comes from X-Profile-Id header


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
    can_edit: bool


router = APIRouter()


@router.post(
    "/new",
    response_model=AgentDetailResponse,
    dependencies=[
        audit_activity("agent.new", "{{ actor.name }} opened new agent form")
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Example using load_sql_typed() - returns SQL string and type classes with type hints
        sql_query, InputType, OutputType = load_sql_typed("app/sql/v3/agents/get_agent_new_complete.sql")
        # InputType: Type[GetAgentNewSqlParams] - for input parameters (empty in this case, profile_id comes from header)
        # OutputType: Type[GetAgentNewSqlRow] - for output rows (nested structure after nest_many)
        
        # Type-safe parameter creation example (if you had parameters):
        # params = InputType(param1=value1, param2=value2)
        # sql_params = params.to_tuple()
        
        sql_params = (profile_id,)
        rows = await conn.fetch(sql_query, profile_id)

        if not rows:
            # Return defaults if no rows
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
                valid_department_ids=[],
                department_mapping={},
                department_prompt_links={},
                prompt_mapping={},
                valid_model_ids=[],
                reasoning_options=["none", "minimal", "low", "medium", "high"],
                temperature_lower=0.0,
                temperature_upper=1.0,
                debug_info=[],
                model_mapping={},
                reasoning_mapping={
                    "none": ReasoningMappingItem(name="None", description="No extended reasoning"),
                    "minimal": ReasoningMappingItem(name="Minimal", description="Basic reasoning for straightforward tasks"),
                    "low": ReasoningMappingItem(name="Low", description="Light reasoning for simple problem-solving"),
                    "medium": ReasoningMappingItem(name="Medium", description="Balanced reasoning for moderate complexity"),
                    "high": ReasoningMappingItem(name="High", description="Deep reasoning for complex, multi-step problems"),
                },
                can_edit=False,
            )
            await set_cached(cache_key_val, {"data": response_data.model_dump()}, ttl=60, tags=tags)
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "0"
            return response_data

        # Use enhanced nest_many to handle top-level lists and nested lists automatically
        # Nested lists (temperature_levels, reasoning_options, available_voices) are automatically grouped
        nested_data = nest_many(rows, list_prefixes={"model_mapping", "department_mapping"})
        
        # Optional: Validate structure matches OutputType (helps catch schema mismatches early)
        # typed_output = OutputType(**nested_data)  # Would raise ValidationError if structure doesn't match

        # Get scalar values from nested data
        actor_name = nested_data.get("actor_name")
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        user_role = nested_data.get("user_role", "trainee")
        primary_department_id = nested_data.get("primary_department_id")
        valid_model_ids = [str(mid) for mid in nested_data.get("valid_model_ids", []) if mid]
        valid_department_ids = [str(did) for did in nested_data.get("valid_department_ids", []) if did]

        # Convert model_mapping list to dict
        # Enhanced nest_many automatically handles nested lists (temperature_levels, reasoning_options, available_voices)
        # We only need to collect unique input_modality/output_modality values (they're scalar fields, not nested lists)
        model_mapping_list = nested_data.get("model_mapping", [])
        model_mapping: ModelMapping = {}
        
        # Collect unique modalities for each model (scalar fields that appear multiple times)
        modality_collector: dict[str, dict[str, set[str]]] = {}
        for row in rows:
            model_id = row.get("model_mapping__id")
            if model_id:
                if model_id not in modality_collector:
                    modality_collector[model_id] = {"input": set(), "output": set()}
                if row.get("model_mapping__input_modality"):
                    modality_collector[model_id]["input"].add(row["model_mapping__input_modality"])
                if row.get("model_mapping__output_modality"):
                    modality_collector[model_id]["output"].add(row["model_mapping__output_modality"])
        
        # Build ModelMapping from nested_data (nested lists already handled by nest_many)
        for model in model_mapping_list:
            model_id = model.get("id")
            if not model_id:
                continue
            
            # Extract nested lists (already grouped by enhanced nest_many)
            temperature_levels = model.get("temperature_levels", [])
            reasoning_options = model.get("reasoning_options", [])
            available_voices = model.get("available_voices", [])
            
            # Get unique modalities (collected separately since they're scalar fields, not nested lists)
            input_mods = sorted(list(modality_collector.get(model_id, {}).get("input", set()))) if modality_collector.get(model_id, {}).get("input") else None
            output_mods = sorted(list(modality_collector.get(model_id, {}).get("output", set()))) if modality_collector.get(model_id, {}).get("output") else None
            
            # Sort nested lists for consistency (nest_many may not preserve order)
            if temperature_levels:
                temperature_levels = sorted(temperature_levels, key=lambda x: x.get("temperature", ""))
            if reasoning_options:
                reasoning_options = sorted(reasoning_options, key=lambda x: x.get("reasoning_level", ""))
            if available_voices:
                available_voices = sorted(available_voices, key=lambda x: x.get("voice", ""))
            
            model_mapping[model_id] = ModelMappingItem(
                name=model.get("name", ""),
                description=model.get("description", ""),
                input_modalities=input_mods,
                output_modalities=output_mods,
                temperature_lower=float(model.get("temperature_lower", 0.0)) if model.get("temperature_lower") is not None else None,
                temperature_upper=float(model.get("temperature_upper", 1.0)) if model.get("temperature_upper") is not None else None,
                temperature_levels=temperature_levels if temperature_levels else None,
                reasoning_options=reasoning_options if reasoning_options else None,
                available_voices=available_voices if available_voices else None,
            )

        # Convert department_mapping list to dict
        department_mapping_list = nested_data.get("department_mapping", [])
        department_mapping: DepartmentMapping = {}
        for dept in department_mapping_list:
            dept_id = dept.get("id")
            if dept_id:
                department_mapping[dept_id] = DepartmentMappingItem(
                    name=dept.get("name", ""),
                    description=dept.get("description", ""),
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
        user_role = nested_data.get("user_role", "trainee")
        is_superadmin = user_role == "superadmin"
        primary_department_id = nested_data.get("primary_department_id")

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
            debug_info=[],
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
            operation="get_agent_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
