"""Persona new endpoint - v3 API following DHH principles."""

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
from app.utils.schema import (
    DepartmentMapping,
    DepartmentMappingItem,
    ModelMapping,
    ModelMappingItem,
    ReasoningMapping,
    ReasoningMappingItem,
)
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class PersonaNewRequest(BaseModel):
    """Request to get default persona details."""

    profileId: str


class PromptInfo(BaseModel):
    """Prompt information."""

    system_prompt: str
    name: str
    description: str
    created_at: str
    updated_at: str
    department_ids: list[str] | None
    can_delete: bool


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
    text_model_id: str | None
    audio_model_id: str | None
    voice: str | None
    reasoning: str | None
    temperature: float
    system_prompt: str
    prompt_id: str | None

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
    valid_text_model_ids: list[str]
    valid_audio_model_ids: list[str]
    reasoning_options: list[str]
    valid_department_ids: list[str]
    temperature_lower: float
    temperature_upper: float

    # Prompt version history
    prompt_mapping: dict[str, PromptInfo]
    department_prompt_links: dict[str, str]

    # Mappings
    text_model_mapping: ModelMapping
    audio_model_mapping: ModelMapping
    reasoning_mapping: ReasoningMapping
    department_mapping: DepartmentMapping

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


@router.post("/new", response_model=PersonaDetailResponse)
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
        # Load SQL query
        sql_query = load_sql("sql/v3/personas/get_persona_new_complete.sql")
        sql_params = (request.profileId,)

        # Execute query
        result = await conn.fetchrow(sql_query, request.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail="Failed to fetch default persona data"
            )

        valid_department_ids = result.get("valid_department_ids", [])
        valid_text_model_ids = result.get("valid_text_model_ids", [])
        valid_audio_model_ids = result.get("valid_audio_model_ids", [])

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

        # Parse text model mapping
        text_model_mapping_data = parse_jsonb(result.get("text_model_mapping"))
        text_model_mapping: ModelMapping = {}
        if isinstance(text_model_mapping_data, dict):
            for model_id, mdata in text_model_mapping_data.items():
                if isinstance(mdata, dict):
                    text_model_mapping[model_id] = ModelMappingItem(
                        name=mdata.get("name", ""),
                        description=mdata.get("description", ""),
                    )

        # Parse audio model mapping
        audio_model_mapping_data = parse_jsonb(result.get("audio_model_mapping"))
        audio_model_mapping: ModelMapping = {}
        if isinstance(audio_model_mapping_data, dict):
            for model_id, mdata in audio_model_mapping_data.items():
                if isinstance(mdata, dict):
                    audio_model_mapping[model_id] = ModelMappingItem(
                        name=mdata.get("name", ""),
                        description=mdata.get("description", ""),
                    )

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

        reasoning_options = ["minimal", "low", "medium", "high"]

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
                name="Medium",
                description="Balanced reasoning for moderate complexity",
            ),
            "high": ReasoningMappingItem(
                name="High",
                description="Deep reasoning for complex, multi-step problems",
            ),
        }

        # Get default text model ID (first valid text model)
        default_text_model_id = (
            valid_text_model_ids[0] if valid_text_model_ids else None
        )
        if not default_text_model_id:
            raise HTTPException(status_code=400, detail="No valid text models found")

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
            text_model_id=default_text_model_id,
            audio_model_id=None,
            voice=None,
            reasoning="none",
            temperature=0.0,
            system_prompt="",
            prompt_id=None,
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
            valid_text_model_ids=valid_text_model_ids,
            valid_audio_model_ids=valid_audio_model_ids,
            reasoning_options=reasoning_options,
            valid_department_ids=valid_department_ids,
            temperature_lower=0.0,
            temperature_upper=2.0,
            # Prompt mappings (empty for create mode)
            prompt_mapping={},
            department_prompt_links={},
            # Mappings
            text_model_mapping=text_model_mapping,
            audio_model_mapping=audio_model_mapping,
            reasoning_mapping=reasoning_mapping,
            department_mapping=department_mapping,
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
