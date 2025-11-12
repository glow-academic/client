"""Persona detail endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.schema import (DepartmentMapping, DepartmentMappingItem,
                              ModelMapping, ModelMappingItem, ReasoningMapping,
                              ReasoningMappingItem)
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel


# Inline request/response schemas
class PersonaDetailRequest(BaseModel):
    """Request to get persona details."""

    personaId: str
    profileId: str


class PromptInfo(BaseModel):
    """Prompt information."""

    system_prompt: str
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
    model_id: str
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
    valid_model_ids: list[str]
    reasoning_options: list[str]
    valid_department_ids: list[str]
    temperature_lower: float
    temperature_upper: float

    # Prompt version history
    prompt_mapping: dict[str, PromptInfo]
    department_prompt_links: dict[str, str]

    # Mappings
    model_mapping: ModelMapping
    reasoning_mapping: ReasoningMapping
    department_mapping: DepartmentMapping

    # Debug info
    debug_info: list[DebugInfoItem]


router = APIRouter()


def parse_jsonb(data: Any) -> dict[str, Any] | list[Any] | None:
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> PersonaDetailResponse:
    """Get detailed persona information."""
    try:
        # Load SQL string
        sql = load_sql("sql/v3/personas/get_persona_detail_complete.sql")

        # Execute query
        result = await conn.fetchrow(sql, request.personaId, request.profileId)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Persona not found: {request.personaId}"
            )

        # Parse valid IDs
        valid_department_ids = result.get("valid_department_ids", [])
        valid_model_ids = result.get("valid_model_ids", [])

        # Parse model mapping
        model_mapping: ModelMapping = {}
        model_mapping_data = parse_jsonb(result.get("model_mapping"))
        if isinstance(model_mapping_data, dict):
            for model_id, mdata in model_mapping_data.items():
                if isinstance(mdata, dict):
                    model_mapping[model_id] = ModelMappingItem(
                        name=mdata.get("name", ""),
                        description=mdata.get("description", ""),
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

        # Parse department_ids for permissions logic
        raw_department_ids = result.get("department_ids")
        department_ids: list[str] | None = None
        if raw_department_ids:
            department_ids = [str(d) for d in raw_department_ids]

        # Get usage and permissions
        scenario_count = int(result.get("usage_count", 0))
        in_use = scenario_count > 0
        total_scenario_links = int(
            result.get("total_scenario_links", scenario_count)
        )
        user_role = str(result.get("user_role", "")).lower()
        has_department_links = bool(department_ids)

        # Permissions mirror list endpoint logic
        can_edit = False
        if scenario_count == 0:
            if has_department_links or user_role == "superadmin":
                if user_role in {"admin", "instructional", "superadmin"}:
                    can_edit = True

        can_duplicate = True

        can_delete = False
        if total_scenario_links == 0:
            if has_department_links or user_role == "superadmin":
                if user_role in {"admin", "instructional", "superadmin"}:
                    can_delete = True

        # Build reasoning_mapping
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

        # Parse prompt_mapping
        prompt_mapping: dict[str, PromptInfo] = {}
        prompt_mapping_data = parse_jsonb(result.get("prompt_mapping"))
        if isinstance(prompt_mapping_data, dict):
            for prompt_id, prompt_data in prompt_mapping_data.items():
                if isinstance(prompt_data, dict):
                    dept_ids = prompt_data.get("department_ids")
                    if isinstance(dept_ids, list):
                        dept_ids = [str(did) for did in dept_ids if did]
                    elif dept_ids is None:
                        dept_ids = None
                    else:
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

        # Parse department_prompt_links
        department_prompt_links: dict[str, str] = {}
        department_prompt_links_data = parse_jsonb(result.get("department_prompt_links"))
        if isinstance(department_prompt_links_data, dict):
            department_prompt_links = {
                str(dept_id): str(prompt_id_val)
                for dept_id, prompt_id_val in department_prompt_links_data.items()
            }

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

        reasoning_options = ["minimal", "low", "medium", "high"]

        # Debug info (empty for now)
        debug_info: list[DebugInfoItem] = []

        return PersonaDetailResponse(
            name=result.get("name", ""),
            description=result.get("description"),
            department_ids=department_ids,
            active=result.get("active", False),
            color=result.get("color", ""),
            icon=result.get("icon", ""),
            model_id=str(result.get("model_id", "")) if result.get("model_id") else "",
            reasoning=result.get("reasoning"),
            temperature=float(result.get("temperature", 0.0)),
            system_prompt=result.get("system_prompt", ""),
            prompt_id=prompt_id,
            in_use=in_use,
            scenario_count=scenario_count,
            can_edit=can_edit,
            can_duplicate=can_duplicate,
            can_delete=can_delete,
            preset_colors=preset_colors,
            suggested_icons=suggested_icons,
            valid_icons=valid_icons,
            valid_model_ids=valid_model_ids,
            reasoning_options=reasoning_options,
            valid_department_ids=valid_department_ids,
            temperature_lower=0.0,
            temperature_upper=2.0,
            prompt_mapping=prompt_mapping,
            department_prompt_links=department_prompt_links,
            model_mapping=model_mapping,
            reasoning_mapping=reasoning_mapping,
            department_mapping=department_mapping,
            debug_info=debug_info,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

