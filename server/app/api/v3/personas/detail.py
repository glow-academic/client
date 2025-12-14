"""Persona detail endpoint - v3 API following DHH principles."""

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


class ExampleMappingItem(BaseModel):
    """Example mapping item."""

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
ExampleMapping = dict[str, ExampleMappingItem]
FieldMapping = dict[str, FieldMappingItem]
ParameterMapping = dict[str, ParameterMappingItem]
AgentMapping = dict[str, AgentMappingItem]


# Inline request/response schemas
class PersonaDetailRequest(BaseModel):
    """Request to get persona details."""

    personaId: str
    profileId: str


class DebugInfoItem(BaseModel):
    """Debug info item."""

    timestamp: str
    message: str


class ExampleWithDepartments(BaseModel):
    """Example with department associations for history."""

    example: str
    department_ids: list[str] | None = None


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
    example_mapping: ExampleMapping

    # Parameter fields
    linked_parameter_ids: list[str]
    parameter_field_ids: list[str]
    valid_parameter_item_ids: list[str]

    # Examples
    example_ids: list[str]
    examples_history: list[ExampleWithDepartments]

    # Debug info
    debug_info: list[DebugInfoItem]


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:  # noqa: ANN401
    """Parse JSONB data with type safety."""
    if isinstance(data, str):
        try:
            loaded = json.loads(data)
        except json.JSONDecodeError:
            return {}
        if isinstance(loaded, (dict, list)):
            return loaded
        return None
    if isinstance(data, (dict, list)):
        return data
    return None


@router.post("/detail", response_model=PersonaDetailResponse)
async def get_persona_detail(
    request: PersonaDetailRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonaDetailResponse:
    """Get detailed persona information."""
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
        # Load SQL string
        sql_query = load_sql("sql/v3/personas/get_persona_detail_complete.sql")
        sql_params = (request.personaId, request.profileId)

        # Execute query
        result = await conn.fetchrow(sql_query, request.personaId, request.profileId)

        if not result:
            # Check if persona exists but user doesn't have department access
            persona_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM personas WHERE id = $1)",
                request.personaId,
            )
            if persona_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this persona. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Persona not found: {request.personaId}"
            )

        # Parse valid IDs
        valid_department_ids = result.get("valid_department_ids", [])
        valid_agent_ids = result.get("valid_agent_ids", [])

        # Parse agent mapping
        agent_mapping: AgentMapping = {}
        agent_mapping_data = parse_jsonb(result.get("agent_mapping"))
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

        # Parse department mapping
        department_mapping: DepartmentMapping = {}
        dept_mapping_data = parse_jsonb(result.get("dept_mapping"))
        if isinstance(dept_mapping_data, dict):
            for dept_id, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse parameter mapping
        parameter_mapping: ParameterMapping = {}
        param_mapping_data = parse_jsonb(result.get("parameter_mapping"))
        if isinstance(param_mapping_data, dict):
            for param_id, pdata in param_mapping_data.items():
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
        field_mapping: FieldMapping = {}
        field_mapping_data = parse_jsonb(result.get("field_mapping"))
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
        linked_parameter_ids = result.get("linked_parameter_ids", [])
        if linked_parameter_ids:
            linked_parameter_ids = [str(p) for p in linked_parameter_ids]
        else:
            linked_parameter_ids = []

        parameter_field_ids = result.get("parameter_field_ids", [])
        if parameter_field_ids:
            parameter_field_ids = [str(f) for f in parameter_field_ids]
        else:
            parameter_field_ids = []

        valid_parameter_item_ids = result.get("valid_parameter_item_ids", [])
        if valid_parameter_item_ids:
            valid_parameter_item_ids = [str(i) for i in valid_parameter_item_ids]
        else:
            valid_parameter_item_ids = []

        # Parse example mapping
        example_mapping: ExampleMapping = {}
        example_mapping_data = parse_jsonb(result.get("example_mapping"))
        if isinstance(example_mapping_data, dict):
            for example_id, edata in example_mapping_data.items():
                if isinstance(edata, dict):
                    example_mapping[example_id] = ExampleMappingItem(
                        name=edata.get("name", ""),
                        description=edata.get("description", ""),
                    )

        # Parse example arrays
        example_ids = result.get("example_ids", [])
        if example_ids:
            example_ids = [str(e) for e in example_ids]
        else:
            example_ids = []

        # Parse examples history
        examples_history: list[ExampleWithDepartments] = []
        examples_history_data = parse_jsonb(result.get("examples_history"))
        if isinstance(examples_history_data, list):
            for ex_item in examples_history_data:
                if isinstance(ex_item, dict):
                    dept_ids = ex_item.get("department_ids")
                    if dept_ids:
                        dept_ids = [str(d) for d in dept_ids]
                    else:
                        dept_ids = None
                    examples_history.append(
                        ExampleWithDepartments(
                            example=ex_item.get("example", ""),
                            department_ids=dept_ids,
                        )
                    )

        # Parse department_ids for permissions logic
        raw_department_ids = result.get("department_ids")
        department_ids: list[str] | None = None
        if raw_department_ids:
            department_ids = [str(d) for d in raw_department_ids]

        # Get usage and permissions
        scenario_count = int(result.get("usage_count", 0))
        in_use = scenario_count > 0
        user_role = str(result.get("user_role", "")).lower()
        has_department_links = bool(department_ids)
        is_default = not has_department_links
        is_superadmin = user_role == "superadmin"

        # Permissions: default objects read-only for non-superadmin
        can_edit = False
        if is_default and not is_superadmin:
            can_edit = False
        elif user_role in {"admin", "instructional", "superadmin"}:
            can_edit = True

        can_duplicate = True

        # Can't delete if can't edit (stricter than can_edit)
        can_delete = False
        if can_edit and scenario_count == 0:
            if has_department_links or user_role == "superadmin":
                if user_role in {"admin", "instructional", "superadmin"}:
                    can_delete = True

        # Hardcoded metadata
        preset_colors = [
            "#ef4444",
            "#f97316",
            "#f59e0b",
            "#eab308",
            "#84cc16",
            "#22c55e",
            "#10b981",
            "#14b8a6",
            "#06b6d4",
            "#0ea5e9",
            "#3b82f6",
            "#6366f1",
            "#8b5cf6",
            "#a855f7",
            "#d946ef",
            "#ec4899",
            "#f43f5e",
        ]

        suggested_icons = [
            "Brain",
            "User",
            "Users",
            "Sparkles",
            "Zap",
            "Heart",
            "Star",
            "MessageSquare",
            "Bot",
            "GraduationCap",
        ]

        valid_icons = [
            "Brain",
            "User",
            "Users",
            "Sparkles",
            "Zap",
            "Heart",
            "Star",
            "MessageSquare",
            "Bot",
            "GraduationCap",
            "Lightbulb",
            "Target",
            "Award",
            "BookOpen",
            "Code",
            "Cpu",
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

        # Debug info (empty for now)
        debug_info: list[DebugInfoItem] = []

        response_data = PersonaDetailResponse(
            name=result.get("name", ""),
            description=result.get("description"),
            department_ids=department_ids,
            active=result.get("active", False),
            color=result.get("color", ""),
            icon=result.get("icon", ""),
            instructions=result.get("instructions", ""),
            in_use=in_use,
            scenario_count=scenario_count,
            can_edit=can_edit,
            can_duplicate=can_duplicate,
            can_delete=can_delete,
            preset_colors=preset_colors,
            suggested_icons=suggested_icons,
            valid_icons=valid_icons,
            valid_agent_ids=valid_agent_ids,
            valid_department_ids=valid_department_ids,
            agent_mapping=agent_mapping,
            department_mapping=department_mapping,
            parameter_mapping=parameter_mapping,
            field_mapping=field_mapping,
            example_mapping=example_mapping,
            linked_parameter_ids=linked_parameter_ids,
            parameter_field_ids=parameter_field_ids,
            valid_parameter_item_ids=valid_parameter_item_ids,
            example_ids=example_ids,
            examples_history=examples_history,
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
            operation="get_persona_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
