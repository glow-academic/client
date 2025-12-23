"""Persona new endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline mapping types (DHH style - no shared types)
class DepartmentMappingItem(BaseModel):
    """Department mapping item."""

    name: str
    description: str


class FieldMappingItem(BaseModel):
    """Field mapping item with parameter context."""

    name: str
    description: str
    parameter_id: str
    parameter_name: str


class ParameterMappingItem(BaseModel):
    """Parameter mapping item."""

    name: str
    description: str
    numerical: bool
    document_parameter: bool
    persona_parameter: bool
    scenario_parameter: bool = False
    video_parameter: bool = False


class AgentMappingItem(BaseModel):
    """Agent mapping item with role information."""

    name: str
    description: str
    roles: list[str]


# Type aliases for Dict mappings
DepartmentMapping = dict[str, DepartmentMappingItem]
FieldMapping = dict[str, FieldMappingItem]
ParameterMapping = dict[str, ParameterMappingItem]
AgentMapping = dict[str, AgentMappingItem]


# Inline request/response schemas
class PersonaNewRequest(BaseModel):
    """Request to get default persona details."""

    pass
    # profileId removed - comes from X-Profile-Id header


class DebugInfoItem(BaseModel):
    """Debug info item."""

    timestamp: str
    message: str


class PersonaDetailResponse(BaseModel):
    """Detailed persona response with all fields and metadata."""

    # Basic persona fields
    name: str
    description: str | None
    department_ids: list[str] | None
    active: bool
    color: str
    icon: str
    instructions: str
    text_agent_id: str | None
    voice_agent_id: str | None

    # Usage and permissions
    in_use: bool
    scenario_count: int
    can_edit: bool
    can_duplicate: bool
    can_delete: bool

    # Metadata/Options
    preset_colors: list[str]
    suggested_icons: list[str]
    valid_icons: list[str]
    valid_agent_ids: list[str]
    valid_department_ids: list[str]

    # Mappings
    agent_mapping: AgentMapping
    department_mapping: DepartmentMapping
    parameter_mapping: ParameterMapping
    field_mapping: FieldMapping

    # Parameter fields
    valid_parameter_ids: list[str]
    valid_parameter_item_ids: list[str]

    # Debug info
    debug_info: list[DebugInfoItem]


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            return json.loads(data)  # type: ignore
        except json.JSONDecodeError:
            return {}
    return data or {}


@router.post(
    "/new",
    response_model=PersonaDetailResponse,
    dependencies=[
        audit_activity("persona.new", "{{ actor.name }} opened new persona form")
    ],
)
async def get_persona_new(
    request: PersonaNewRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonaDetailResponse:
    """Get default persona structure for creation mode."""
    tags = ["personas"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return PersonaDetailResponse.model_validate(cached["data"])

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

        # Load SQL query
        sql_query = load_sql("sql/v3/personas/get_persona_new_complete.sql")
        sql_params = (profile_id,)

        # Execute query
        result = await conn.fetchrow(sql_query, profile_id)

        if not result:
            raise HTTPException(
                status_code=404, detail="Failed to fetch default persona data"
            )

        # Set audit context
        actor_name = result.get("actor_name")
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        valid_department_ids = result.get("valid_department_ids", [])
        valid_agent_ids = result.get("valid_agent_ids", [])

        # Get user role and primary department for default behavior
        user_role = str(result.get("user_role", "")).lower()
        is_superadmin = user_role == "superadmin"
        primary_department_id = result.get("primary_department_id")

        # Set default department_ids based on role
        # Superadmin: None (empty = all departments = default object)
        # Non-superadmin: [primaryDepartmentId] if available
        if is_superadmin:
            default_department_ids = None
        else:
            default_department_ids = (
                [primary_department_id] if primary_department_id else []
            )

        is_default = default_department_ids is None or len(default_department_ids) == 0

        # For default personas, only superadmin can edit
        can_edit_default = not (is_default and not is_superadmin)

        if not valid_department_ids:
            raise HTTPException(
                status_code=400, detail="No accessible departments found for user"
            )

        # Parse department_mapping
        department_mapping_data = parse_jsonb(result.get("dept_mapping"))
        department_mapping: DepartmentMapping = {}
        if isinstance(department_mapping_data, dict):
            for dept_id, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse agent mapping
        agent_mapping_data = parse_jsonb(result.get("agent_mapping"))
        agent_mapping: AgentMapping = {}
        if isinstance(agent_mapping_data, dict):
            for agent_id, adata in agent_mapping_data.items():
                if isinstance(adata, dict):
                    roles = adata.get("roles", [])
                    if isinstance(roles, list):
                        roles = [str(r) for r in roles]
                    else:
                        roles = []
                    agent_mapping[agent_id] = AgentMappingItem(
                        name=adata.get("name", ""),
                        description=adata.get("description", ""),
                        roles=roles,
                    )

        # Parse parameter mapping
        parameter_mapping_data = parse_jsonb(result.get("parameter_mapping"))
        parameter_mapping: ParameterMapping = {}
        if isinstance(parameter_mapping_data, dict):
            for param_id, pdata in parameter_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[param_id] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        numerical=pdata.get("numerical", False),
                        document_parameter=pdata.get("document_parameter", False),
                        persona_parameter=pdata.get("persona_parameter", False),
                        scenario_parameter=pdata.get("scenario_parameter", False),
                        video_parameter=pdata.get("video_parameter", False),
                    )

        # Parse parameter item mapping
        field_mapping_data = parse_jsonb(result.get("field_mapping"))
        field_mapping: FieldMapping = {}
        if isinstance(field_mapping_data, dict):
            for item_id, idata in field_mapping_data.items():
                if isinstance(idata, dict):
                    field_mapping[item_id] = FieldMappingItem(
                        name=idata.get("name", ""),
                        description=idata.get("description", ""),
                        parameter_id=idata.get("parameter_id", ""),
                        parameter_name=idata.get("parameter_name", ""),
                    )

        # Parse parameter arrays
        valid_parameter_ids = result.get("valid_parameter_ids", [])
        if valid_parameter_ids:
            valid_parameter_ids = [str(p) for p in valid_parameter_ids]
        else:
            valid_parameter_ids = []

        valid_parameter_item_ids = result.get("valid_parameter_item_ids", [])
        if valid_parameter_item_ids:
            valid_parameter_item_ids = [str(i) for i in valid_parameter_item_ids]
        else:
            valid_parameter_item_ids = []

        # Hardcoded metadata
        preset_colors = [
            "#EF4444",
            "#F97316",
            "#F59E0B",
            "#10B981",
            "#3B82F6",
            "#6366F1",
            "#8B5CF6",
            "#EC4899",
        ]

        suggested_icons = ["Sparkles", "Zap", "Star", "Heart", "Users"]

        valid_icons = [
            "Activity",
            "Anchor",
            "Award",
            "Bell",
            "Book",
            "Briefcase",
            "Calendar",
            "Camera",
            "ChevronRight",
            "Clock",
            "Cloud",
            "Code",
            "Compass",
            "Database",
            "FileText",
            "Globe",
            "Mail",
            "Mic",
            "Monitor",
            "Phone",
            "Radio",
            "Search",
            "Settings",
            "Shield",
            "Video",
            "Wifi",
        ]

        # Get default text agent ID (first valid agent with simulation-text role)
        default_text_agent_id = None
        for agent_id in valid_agent_ids:
            agent = agent_mapping.get(agent_id)
            if agent and "simulation-text" in agent.roles:
                default_text_agent_id = agent_id
                break

        if not default_text_agent_id:
            raise HTTPException(
                status_code=400, detail="No valid simulation-text agents found"
            )

        # Debug info (empty for now)
        debug_info: list[DebugInfoItem] = []

        response_data = PersonaDetailResponse(
            # Basic fields (empty defaults for creation)
            name="",
            description="",
            department_ids=default_department_ids,  # Use department_ids from default persona
            active=True,
            color=preset_colors[0] if preset_colors else "#3B82F6",
            icon=suggested_icons[0] if suggested_icons else "Sparkles",
            instructions="",  # Always blank for new persona
            text_agent_id=default_text_agent_id,
            voice_agent_id=None,
            # Usage and permissions
            in_use=False,
            scenario_count=0,
            can_edit=can_edit_default,
            can_duplicate=False,
            can_delete=False,
            # Metadata
            preset_colors=preset_colors,
            suggested_icons=suggested_icons,
            valid_icons=valid_icons,
            valid_agent_ids=valid_agent_ids,
            valid_department_ids=valid_department_ids,
            # Mappings
            agent_mapping=agent_mapping,
            department_mapping=department_mapping,
            parameter_mapping=parameter_mapping,
            field_mapping=field_mapping,
            # Parameter fields
            valid_parameter_ids=valid_parameter_ids,
            valid_parameter_item_ids=valid_parameter_item_ids,
            # Debug info
            debug_info=debug_info,
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_persona_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
