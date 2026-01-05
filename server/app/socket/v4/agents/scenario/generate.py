"""Handler for generate_scenario WebSocket event."""

import asyncio
import json
import os
import uuid
from typing import Any, cast

import asyncpg
from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    function_tool,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, ValidationError, create_model
from utils.settings.theme import ThemePrimitives, derive_theme_tokens
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.debug.debug_info import debug_info as debug_info_tool
from app.infra.v4.documents.format_document_info import format_document_info
from app.infra.v4.templates.jinja_renderer import render_template
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import UPLOAD_FOLDER, get_internal_sio, sio
from app.sql.types import (
    GetScenarioRunContextAndCreateRunSqlParams,
    GetScenarioRunContextAndCreateRunSqlRow,
)
from app.utils.schema_helper import get_schema_tree

internal_sio = get_internal_sio()
SQL_PATH = "app/sql/v4/scenario/get_scenario_run_context_and_create_run_complete.sql"

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class ScenarioGenerationProgressPayload(BaseModel):
    """Response indicating progress in scenario generation."""

    type: str  # "start", "tool_call", "complete"
    message: str | None = None
    tool_name: str | None = None
    trace_id: str | None = None


class ScenarioGenerationCompletePayload(BaseModel):
    """Response indicating scenario generation completed successfully."""

    success: bool
    message: str
    trace_id: str | None = None


class ScenarioGenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in scenario generation."""

    success: bool
    message: str
    trace_id: str | None = None


class ScenarioRandomizeErrorPayload(BaseModel):
    """Response indicating an error occurred in scenario randomization."""

    success: bool
    message: str


class RandomizeScenarioPayload(BaseModel):
    """Request to randomize scenario selections (without generation)."""

    scenarioId: str | None = None
    randomize: str  # "all", "persona", "document", "parameters", "parameter_{paramId}"
    departmentIds: list[str] | None = None
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    templateDocumentIds: list[str] | None = None
    parameterIds: list[str] | None = None
    fieldIds: list[str] | None = None
    personaSearch: str | None = None
    documentSearch: str | None = None
    parameterSearch: str | None = None
    personaMin: int | None = None
    personaMax: int | None = None
    documentMin: int | None = None
    documentMax: int | None = None
    parameterSelectionMin: int | None = None
    parameterSelectionMax: int | None = None
    fieldRanges: dict[str, dict[str, int]] | None = None
    useImage: bool | None = None
    useVideo: bool | None = None
    profileId: str  # Required for context


class ScenarioImageGenerationProgressPayload(BaseModel):
    """Response indicating progress in scenario image generation."""

    type: str  # "start", "generating", "completed"
    message: str | None = None
    image_id: str | None = None
    trace_id: str | None = None


class ScenarioImageGenerationCompletePayload(BaseModel):
    """Response indicating scenario image generation completed successfully."""

    success: bool
    image_id: str
    upload_id: str
    name: str
    trace_id: str | None = None


class ScenarioImageGenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in scenario image generation."""

    success: bool
    image_id: str
    message: str
    trace_id: str | None = None


# Pydantic model for client-to-server event
class GenerateScenarioAIPayload(BaseModel):
    """Request to generate a scenario using AI."""

    departmentId: str
    scenarioAgentId: str  # Required: UI filters and selects appropriate agent for scenario generation
    imageAgentId: str | None = (
        None  # Optional: Agent ID for image generation (required when images are enabled)
    )
    videoAgentId: str | None = (
        None  # Optional: Agent ID for video generation (required when videos are enabled)
    )
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    fieldIds: list[str] | None = None
    profileId: str | None = None
    scenarioId: str | None = None  # Optional scenario ID to link generated resources
    simulationId: str | None = (
        None  # Optional simulation ID - if present, will emit advance after generation
    )
    attemptId: str | None = (
        None  # Optional attempt ID - used with simulationId for advance
    )
    objectivesMin: int | None = None
    objectivesMax: int | None = None
    imagesEnabled: bool = False  # Flag to enable image generation
    videoEnabled: bool = False  # Flag to enable video generation
    objectivesEnabled: bool = False  # Flag to enable objectives generation
    questionsEnabled: bool = False  # Flag to enable questions generation
    videoLength: int | None = None  # Optional: Video length in seconds (4, 8, or 12)
    # Randomization support
    skipGeneration: bool = False  # If True, only randomize, don't generate
    randomizeType: str | None = (
        None  # "all", "persona", "document", "parameters", "parameter_{paramId}"
    )


# Emit helper functions
async def scenario_generation_progress(
    payload: ScenarioGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "scenarios_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def scenario_generation_complete(
    payload: ScenarioGenerationCompletePayload, room: str
) -> None:
    await sio.emit("scenarios_generation_complete", payload.model_dump(), room=room)


async def scenario_generation_error(
    payload: ScenarioGenerationErrorPayload, room: str
) -> None:
    await sio.emit("scenarios_generation_error", payload.model_dump(), room=room)


async def _emit_scenario_error_with_simulation_context(
    sid: str,
    message: str,
    attempt_id: str | None = None,
    simulation_id: str | None = None,
) -> None:
    """Helper to emit scenario error via error handler with simulation context."""
    if attempt_id or simulation_id:
        await internal_sio.emit(
            "scenario_error",
            {
                "sid": sid,
                "success": False,
                "message": message,
                "attempt_id": attempt_id,
                "simulation_id": simulation_id,
                "operation": "scenario_generation",
            },
        )


async def scenario_randomize_error(
    payload: ScenarioRandomizeErrorPayload, room: str
) -> None:
    await sio.emit("scenario_randomize_error", payload.model_dump(), room=room)


async def scenario_image_generation_progress(
    payload: ScenarioImageGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "scenario_image_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def scenario_image_generation_complete(
    payload: ScenarioImageGenerationCompletePayload, room: str
) -> None:
    await sio.emit(
        "scenario_image_generation_complete", payload.model_dump(), room=room
    )


async def scenario_image_generation_error(
    payload: ScenarioImageGenerationErrorPayload, room: str
) -> None:
    await sio.emit("scenario_image_generation_error", payload.model_dump(), room=room)


# Helper function to build Pydantic models dynamically from template schemas
def _build_template_model(schema: dict[str, Any]) -> type[BaseModel]:
    """Build a Pydantic model from a template schema.

    Args:
        schema: Template schema dict with 'name' and 'fields' keys

    Returns:
        A dynamically created Pydantic model class with strict schema (no additionalProperties)
    """
    fields_data = schema.get("fields", [])
    if not fields_data:
        # If no fields, return a simple model with no fields and strict config
        model = create_model(
            "TemplateArgs",
            __base__=BaseModel,
            __config__=ConfigDict(extra="forbid"),  # Disallow extra fields
        )
        return model  # type: ignore[return-value]

    # Build field definitions for the model
    field_definitions: dict[str, Any] = {}

    for field in fields_data:
        field_name = field.get("name")
        if not field_name:
            continue

        field_type = field.get("type", "string")
        required = field.get("required", False)
        description = field.get("description", "")
        placeholder = field.get("placeholder", "")

        # Build description with placeholder if available
        field_description = description
        if placeholder:
            field_description = (
                f"{description} (Example: {placeholder})"
                if description
                else f"Example: {placeholder}"
            )

        # Map field types to Python types
        python_type: Any
        if field_type == "string":
            python_type = str
        elif field_type == "array":
            # Arrays always have an 'item' definition in the schema
            item_def = field.get("item", {})
            if not item_def:
                # Fallback: if no item definition, use list[str] (shouldn't happen in practice)
                python_type = list[str]
            elif item_def.get("type") == "object":
                # Array of objects - always build a proper Pydantic model
                item_fields = item_def.get("fields", [])
                if item_fields:
                    # Build nested model for array items
                    item_schema = {
                        "name": f"{field_name}_item",
                        "fields": item_fields,
                    }
                    item_model = _build_template_model(item_schema)
                    # Runtime-created models can't be statically typed, but will generate strict schemas
                    # Use Any to avoid type checker issues with dynamic types
                    python_type = list[item_model]  # type: ignore
                else:
                    # Empty object - create empty model (shouldn't happen in practice)
                    empty_item_model = create_model(
                        f"{field_name}_item",
                        __base__=BaseModel,
                        __config__=ConfigDict(extra="forbid"),
                    )
                    # Runtime-created models can't be statically typed, but will generate strict schemas
                    # Use Any to avoid type checker issues with dynamic types
                    python_type = list[empty_item_model]  # type: ignore
            else:
                # Array of primitives - item.type should be "string", "number", etc.
                item_type = item_def.get("type", "string")
                if item_type == "string":
                    python_type = list[str]
                elif item_type == "number":
                    python_type = list[float]
                elif item_type == "boolean":
                    python_type = list[bool]
                else:
                    # Default to string for unknown primitive types
                    python_type = list[str]
        elif field_type == "object":
            # Objects always have a 'fields' array in the schema
            nested_fields = field.get("fields", [])
            if nested_fields:
                # Recursively build nested model
                nested_schema = {
                    "name": f"{field_name}_nested",
                    "fields": nested_fields,
                }
                nested_model = _build_template_model(nested_schema)
                # Store as Any to avoid type checker issues, but it's actually Type[BaseModel]
                python_type = nested_model  # type: ignore[assignment, misc]
            else:
                # Empty object - create empty model (shouldn't happen in practice)
                empty_model = create_model(
                    f"{field_name}_empty",
                    __base__=BaseModel,
                    __config__=ConfigDict(extra="forbid"),
                )
                python_type = empty_model  # type: ignore[assignment, misc]
        else:
            # Default to str for unknown types (safer than Any)
            python_type = str

        # Create Field with description and required flag
        if required:
            field_definitions[field_name] = (
                python_type,
                Field(..., description=field_description),
            )
        else:
            field_definitions[field_name] = (
                python_type | None,
                Field(default=None, description=field_description),
            )

    # Create the model dynamically with strict config to prevent additionalProperties
    model_name = schema.get("name", "TemplateArgs").replace(" ", "").replace(":", "")
    model = create_model(
        f"{model_name}Args",
        __base__=BaseModel,
        __config__=ConfigDict(
            extra="forbid"
        ),  # Disallow extra fields - critical for strict schemas
        **field_definitions,
    )

    return model  # type: ignore[return-value]


async def _randomize_missing_scenario_values(
    conn: asyncpg.Connection,
    scenario_id: uuid.UUID | None,
    profile_id: uuid.UUID,
    department_id: uuid.UUID | None,
    existing_persona_ids: list[uuid.UUID] | None = None,
    existing_document_ids: list[uuid.UUID] | None = None,
    existing_field_ids: list[uuid.UUID] | None = None,
    randomize_type: str
    | None = None,  # "all", "persona", "document", "parameters", "parameter_{paramId}"
    parameter_id_to_randomize: uuid.UUID
    | None = None,  # For "parameter_{paramId}" case
) -> dict[str, Any]:
    """
    Randomize missing scenario values (persona, documents, parameters).

    This is the centralized randomization logic used by both frontend and simulation flow.
    Only randomizes values that are missing (None or empty), or based on randomize_type.

    Args:
        conn: Database connection
        scenario_id: Parent scenario ID (for getting ranges and existing links)
        profile_id: Profile ID for department fallback
        department_id: Department ID (can be None, will be selected)
        existing_persona_ids: Existing persona IDs (if provided, won't randomize unless randomize_type forces it)
        existing_document_ids: Existing document IDs (if provided, won't randomize unless randomize_type forces it)
        existing_field_ids: Existing field IDs (if provided, won't randomize unless randomize_type forces it)
        randomize_type: If provided, only randomize this type ("persona", "document", "parameters", "parameter_{paramId}")
                       If None, randomize all missing values
        parameter_id_to_randomize: If randomize_type is "parameter_{paramId}", this is the param ID

    Returns:
        Dict with randomized selections:
        - persona_ids: list[uuid.UUID] | None
        - document_ids: list[uuid.UUID] | None
        - field_ids: list[uuid.UUID] | None
        - department_id: uuid.UUID | None
    """
    import random

    def parse_jsonb(data: Any) -> list[dict[str, Any]]:
        """Parse JSONB data with type safety."""
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except json.JSONDecodeError:
                return []
        if not isinstance(data, list):
            return []
        return [dict(item) for item in data]

    # Step 1: Department selection with fallback logic
    selected_department_id: uuid.UUID | None = department_id

    if not selected_department_id and scenario_id:
        # Get department_ids from scenario_departments
        sql = load_sql("app/sql/v4/scenario/get_scenario_departments.sql")
        scenario_dept_rows = await conn.fetch(sql, scenario_id)
        scenario_dept_ids = (
            [uuid.UUID(str(row["department_id"])) for row in scenario_dept_rows]
            if scenario_dept_rows
            else None
        )

        if scenario_dept_ids and len(scenario_dept_ids) > 0:
            selected_department_id = random.choice(scenario_dept_ids)
    if not selected_department_id and profile_id:
        sql = load_sql("app/sql/v4/profile/get_departments_for_profile.sql")
        profile_dept_rows = await conn.fetch(sql, str(profile_id))
        if profile_dept_rows and len(profile_dept_rows) > 0:
            profile_dept_ids = [uuid.UUID(str(row["id"])) for row in profile_dept_rows]
            selected_department_id = random.choice(profile_dept_ids)
    if not selected_department_id:
        # Step 2: Get randomization ranges
        scenario_id_uuid = scenario_id
    if scenario_id_uuid:
        sql = load_sql("app/sql/v4/scenario/get_randomization_ranges.sql")
        ranges_result = await conn.fetchrow(sql, scenario_id_uuid)
        if not ranges_result:
            persona_min = 1
            persona_max = 3
            document_min = 0
            document_max = 3
            parameter_min = 0
            parameter_max = 3
            field_ranges_json: dict[str, dict[str, int]] = {}
        else:
            persona_min = ranges_result.get("persona_min", 1)
            persona_max = ranges_result.get("persona_max", 3)
            document_min = ranges_result.get("document_min", 0)
            document_max = ranges_result.get("document_max", 3)
            parameter_min = ranges_result.get("parameter_min", 0)
            parameter_max = ranges_result.get("parameter_max", 3)
            field_ranges_raw = ranges_result.get("field_ranges_json", {})
            if isinstance(field_ranges_raw, str):
                try:
                    field_ranges_json = json.loads(field_ranges_raw)
                except json.JSONDecodeError:
                    field_ranges_json = {}
            elif isinstance(field_ranges_raw, dict):
                field_ranges_json = field_ranges_raw
            else:
                field_ranges_json = {}
    else:
        # Default ranges if no scenario_id
        persona_min = 1
        persona_max = 3
        document_min = 0
        document_max = 3
        parameter_min = 0
        parameter_max = 3
        field_ranges_json = {}

    # Step 3: Load randomization data
    dept_uuids: list[uuid.UUID] = (
        [] if not selected_department_id else [selected_department_id]
    )

    # Use typed SQL function instead of raw SQL
    try:
        from app.sql.types import (
            GetRandomizationDataSqlParams,
            GetRandomizationDataSqlRow,
        )

        sql_params = GetRandomizationDataSqlParams(
            department_ids=dept_uuids, scenario_id=scenario_id_uuid
        )
        result = await execute_sql_typed(
            conn,
            "app/sql/v4/scenario/get_randomization_data_complete.sql",
            params=sql_params,
        )
        result_row = cast(GetRandomizationDataSqlRow, result)

        # Extract arrays from composite types (now arrays of composite types, not JSONB)
        # Convert composite type arrays to dict lists for compatibility
        personas_data = [
            {"id": str(p.id), "name": p.name, "description": p.description}
            for p in result_row.personas
        ]
        documents_data = [
            {"id": str(d.id), "name": d.name, "type": d.type, "file_path": d.file_path}
            for d in result_row.documents
        ]
        parameters_data = [
            {
                "id": str(p.id),
                "name": p.name,
                "description": p.description,
                "document_parameter": p.document_parameter,
                "persona_parameter": p.persona_parameter,
            }
            for p in result_row.parameters
        ]
        parameter_items_data = [
            {
                "id": str(pi.id),
                "name": pi.name,
                "description": pi.description,
                "parameter_id": str(pi.parameter_id),
            }
            for pi in result_row.parameter_items
        ]
        document_parameter_items_data = [
            {
                "document_id": str(dpi.document_id),
                "parameter_item_id": str(dpi.parameter_item_id),
            }
            for dpi in result_row.document_parameter_items
        ]

        # Get existing scenario links if scenario_id provided
        existing_scenario_persona_ids = result_row.persona_ids or []
        existing_scenario_document_ids = result_row.document_ids or []
        existing_scenario_parameter_item_ids = result_row.parameter_item_ids or []
    except ImportError:
        # Fallback if types not generated yet - use old JSONB approach
        sql = load_sql("app/sql/v4/scenario/get_randomization_data_complete.sql")
        result = await conn.fetchrow(sql, dept_uuids, scenario_id_uuid)
        if not result:
            raise ValueError("Failed to fetch randomization data")

        # Parse JSONB aggregations (fallback)
        personas_data = parse_jsonb(result.get("personas", []))
        documents_data = parse_jsonb(result.get("documents", []))
        parameters_data = parse_jsonb(result.get("parameters", []))
        parameter_items_data = parse_jsonb(result.get("parameter_items", []))
        document_parameter_items_data = parse_jsonb(
            result.get("document_parameter_items", [])
        )

        # Get existing scenario links if scenario_id provided
        existing_scenario_persona_ids = result.get("persona_ids", []) or []
        existing_scenario_document_ids = result.get("document_ids", []) or []
        existing_scenario_parameter_item_ids = (
            result.get("parameter_item_ids", []) or []
        )

    # Build lookup maps
    active_personas = []
    for p in personas_data:
        if "id" not in p:
            continue
        active_personas.append(
            {
                **p,
                "id": uuid.UUID(str(p["id"])),
            }
        )

    active_documents = []
    for d in documents_data:
        if "id" not in d:
            continue
        active_documents.append(
            {
                **d,
                "id": uuid.UUID(str(d["id"])),
            }
        )

    active_parameters = []
    for p in parameters_data:
        if "id" not in p:
            continue
        active_parameters.append(
            {
                **p,
                "id": uuid.UUID(str(p["id"])),
                "document_parameter": p.get("document_parameter", False),
                "persona_parameter": p.get("persona_parameter", False),
            }
        )

    all_parameter_items = []
    for pi in parameter_items_data:
        if "id" not in pi or "parameter_id" not in pi:
            continue
        all_parameter_items.append(
            {
                **pi,
                "id": uuid.UUID(str(pi["id"])),
                "parameter_id": uuid.UUID(str(pi["parameter_id"])),
            }
        )

    document_parameter_items_junction = []
    for j in document_parameter_items_data:
        if "document_id" not in j or "parameter_item_id" not in j:
            continue
        document_parameter_items_junction.append(
            {
                "document_id": uuid.UUID(str(j["document_id"])),
                "parameter_item_id": uuid.UUID(str(j["parameter_item_id"])),
            }
        )

    parameter_items_by_id: dict[uuid.UUID, dict[str, Any]] = {}
    for pi in all_parameter_items:
        parameter_items_by_id[pi["id"]] = pi

    parameter_items_by_param_id: dict[uuid.UUID, list[dict[str, Any]]] = {}
    for pi in all_parameter_items:
        param_id = pi["parameter_id"]
        if param_id not in parameter_items_by_param_id:
            parameter_items_by_param_id[param_id] = []
        parameter_items_by_param_id[param_id].append(pi)

    documents_by_id: dict[uuid.UUID, dict[str, Any]] = {}
    for d in active_documents:
        documents_by_id[d["id"]] = d

    # Determine what to randomize based on randomize_type
    should_randomize_persona = (
        randomize_type is None or randomize_type == "all" or randomize_type == "persona"
    )
    should_randomize_documents = (
        randomize_type is None
        or randomize_type == "all"
        or randomize_type == "document"
    )
    should_randomize_parameters = (
        randomize_type is None
        or randomize_type == "all"
        or randomize_type == "parameters"
        or (randomize_type and randomize_type.startswith("parameter_"))
    )

    # Step 4: Persona selection (only if missing or randomize_type forces it)
    scenario_persona_ids: list[uuid.UUID] = []
    if should_randomize_persona:
        if existing_persona_ids:
            scenario_persona_ids = existing_persona_ids
        elif scenario_id_uuid and existing_scenario_persona_ids:
            scenario_persona_ids = [uuid.UUID(p) for p in existing_scenario_persona_ids]
        elif active_personas:
            # Randomize persona
            available_count = len(active_personas)
            capped_max = min(persona_max, available_count)
            effective_min = min(persona_min, available_count)
            if effective_min <= capped_max:
                count = random.randint(effective_min, capped_max)
                shuffled = active_personas.copy()
                random.shuffle(shuffled)
                scenario_persona_ids = [p["id"] for p in shuffled[:count]]
            else:
                selected_persona = random.choice(active_personas)
                scenario_persona_ids = [selected_persona["id"]]
    else:
        # Keep existing persona_ids if not randomizing
        if existing_persona_ids:
            scenario_persona_ids = existing_persona_ids
        elif scenario_id_uuid and existing_scenario_persona_ids:
            scenario_persona_ids = [uuid.UUID(p) for p in existing_scenario_persona_ids]

    # Step 5: Persona parameter selection (only if randomizing parameters)
    persona_param_ids: list[uuid.UUID] = []
    if should_randomize_parameters:
        persona_parameters = [
            p for p in active_parameters if p.get("persona_parameter", False)
        ]
        if persona_parameters:
            for param in persona_parameters:
                param_items = parameter_items_by_param_id.get(param["id"], [])
                if param_items:
                    param_id_str = str(param["id"])
                    param_range = field_ranges_json.get(param_id_str, {})
                    param_min = (
                        param_range.get("min", 1)
                        if isinstance(param_range, dict)
                        else 1
                    )
                    param_max = (
                        param_range.get("max", 3)
                        if isinstance(param_range, dict)
                        else 3
                    )

                    available_count = len(param_items)
                    capped_max = min(param_max, available_count)
                    effective_min = min(param_min, available_count)

                    if effective_min <= capped_max:
                        count = random.randint(effective_min, capped_max)
                        shuffled = param_items.copy()
                        random.shuffle(shuffled)
                        selected_items = shuffled[:count]
                        persona_param_ids.extend(
                            [item["id"] for item in selected_items]
                        )
                    else:
                        selected_item = random.choice(param_items)
                        persona_param_ids.append(selected_item["id"])

    # Step 6: Parameter item selection (only if missing or randomize_type forces it)
    param_ids: list[uuid.UUID] = []
    if should_randomize_parameters:
        # Handle selective parameter randomization
        if (
            randomize_type
            and randomize_type.startswith("parameter_")
            and parameter_id_to_randomize
        ):
            # Only randomize items for this specific parameter
            param_items = parameter_items_by_param_id.get(parameter_id_to_randomize, [])
            if param_items:
                param_id_str = str(parameter_id_to_randomize)
                param_range = field_ranges_json.get(param_id_str, {})
                param_min = (
                    param_range.get("min", 1) if isinstance(param_range, dict) else 1
                )
                param_max = (
                    param_range.get("max", 3) if isinstance(param_range, dict) else 3
                )

                available_count = len(param_items)
                capped_max = min(param_max, available_count)
                effective_min = min(param_min, available_count)

                if effective_min <= capped_max:
                    count = random.randint(effective_min, capped_max)
                    shuffled = param_items.copy()
                    random.shuffle(shuffled)
                    selected_items = shuffled[:count]
                    param_ids.extend([item["id"] for item in selected_items])
                else:
                    selected_item = random.choice(param_items)
                    param_ids.append(selected_item["id"])
            # Keep existing field_ids for other parameters
            if existing_field_ids:
                other_param_ids = [
                    fid for fid in existing_field_ids if fid not in param_ids
                ]
                param_ids.extend(other_param_ids)
        elif existing_field_ids:
            param_ids = existing_field_ids
        elif scenario_id_uuid and existing_scenario_parameter_item_ids:
            param_ids = [uuid.UUID(p) for p in existing_scenario_parameter_item_ids]
        else:
            # Randomize parameters
            general_parameters = [
                p
                for p in active_parameters
                if not p.get("document_parameter", False)
                and not p.get("persona_parameter", False)
            ]
            if general_parameters:
                available_count = len(general_parameters)
                capped_max = min(parameter_max, available_count)
                effective_min = min(parameter_min, available_count)
                if effective_min <= capped_max:
                    count = random.randint(effective_min, capped_max)
                    shuffled = general_parameters.copy()
                    random.shuffle(shuffled)
                    selected_parameters = shuffled[:count]
                else:
                    selected_parameters = [random.choice(general_parameters)]

                for param in selected_parameters:
                    param_items = parameter_items_by_param_id.get(param["id"], [])
                    if param_items:
                        param_id_str = str(param["id"])
                        param_range = field_ranges_json.get(param_id_str, {})
                        param_min = (
                            param_range.get("min", 1)
                            if isinstance(param_range, dict)
                            else 1
                        )
                        param_max = (
                            param_range.get("max", 3)
                            if isinstance(param_range, dict)
                            else 3
                        )

                        available_count = len(param_items)
                        capped_max = min(param_max, available_count)
                        effective_min = min(param_min, available_count)

                        if effective_min <= capped_max:
                            count = random.randint(effective_min, capped_max)
                            shuffled = param_items.copy()
                            random.shuffle(shuffled)
                            selected_items = shuffled[:count]
                            param_ids.extend([item["id"] for item in selected_items])
                        else:
                            selected_item = random.choice(param_items)
                            param_ids.append(selected_item["id"])
    else:
        # Keep existing field_ids if not randomizing
        if existing_field_ids:
            param_ids = existing_field_ids
        elif scenario_id_uuid and existing_scenario_parameter_item_ids:
            param_ids = [uuid.UUID(p) for p in existing_scenario_parameter_item_ids]

    # Combine persona params with general params
    all_param_ids = list(set(persona_param_ids + param_ids))

    # Step 7: Document selection (only if missing or randomize_type forces it)
    doc_ids: list[uuid.UUID] = []
    if should_randomize_documents:
        if existing_document_ids:
            doc_ids = existing_document_ids
        elif scenario_id_uuid and existing_scenario_document_ids:
            doc_ids = [uuid.UUID(d) for d in existing_scenario_document_ids]
        elif active_documents:
            # Randomize documents (prefer documents matching parameter items)
            doc_matching_param_item_ids = all_param_ids.copy() if all_param_ids else []

            if not doc_matching_param_item_ids and active_parameters:
                for param in active_parameters:
                    param_items = parameter_items_by_param_id.get(param["id"], [])
                    if param_items:
                        selected_item = random.choice(param_items)
                        doc_matching_param_item_ids.append(selected_item["id"])

            matching_documents = []
            if doc_matching_param_item_ids:
                matching_documents = [
                    documents_by_id[j["document_id"]]
                    for j in document_parameter_items_junction
                    if j["parameter_item_id"] in doc_matching_param_item_ids
                    and j["document_id"] in documents_by_id
                ]

            available_documents = (
                matching_documents if matching_documents else active_documents
            )
            if available_documents:
                available_count = len(available_documents)
                capped_max = min(document_max, available_count)
                effective_min = min(document_min, available_count)
                if effective_min <= capped_max:
                    count = random.randint(effective_min, capped_max)
                    shuffled = available_documents.copy()
                    random.shuffle(shuffled)
                    doc_ids = [d["id"] for d in shuffled[:count]]
                else:
                    if effective_min == 0:
                        doc_ids = []
                    else:
                        selected_doc = random.choice(available_documents)
                        doc_ids = [selected_doc["id"]]
    else:
        # Keep existing document_ids if not randomizing
        if existing_document_ids:
            doc_ids = existing_document_ids
        elif scenario_id_uuid and existing_scenario_document_ids:
            doc_ids = [uuid.UUID(d) for d in existing_scenario_document_ids]

    # Step 8: Document parameter extraction
    document_param_ids: list[uuid.UUID] = []
    if doc_ids:
        for doc_id in doc_ids:
            doc_param_items = [
                j["parameter_item_id"]
                for j in document_parameter_items_junction
                if j["document_id"] == doc_id
            ]
            for param_item_id in doc_param_items:
                param_item = parameter_items_by_id.get(param_item_id)
                if param_item:
                    param_id = param_item["parameter_id"]
                    param_dict: dict[str, Any] | None = next(
                        (p for p in active_parameters if p["id"] == param_id), None
                    )
                    if param_dict and param_dict.get("document_parameter", False):
                        if param_item_id not in document_param_ids:
                            document_param_ids.append(param_item_id)

    # Combine all parameter item IDs
    final_field_ids = list(set(all_param_ids + document_param_ids))

    return {
        "persona_ids": scenario_persona_ids if scenario_persona_ids else None,
        "document_ids": doc_ids if doc_ids else None,
        "field_ids": final_field_ids if final_field_ids else None,
        "department_id": selected_department_id,
    }


async def _generate_scenario_impl(sid: str, data: GenerateScenarioAIPayload) -> None:
    """Handle scenario generation requests via WebSocket."""
    # trace_id will be retrieved from SQL result (from groups.trace_id - auto-generated by database)
    trace_id: str | None = None

    try:
        # Convert string IDs to UUIDs
        department_id = uuid.UUID(data.departmentId)
        persona_ids = (
            [uuid.UUID(p) for p in data.personaIds] if data.personaIds else None
        )
        persona_id = persona_ids[0] if persona_ids and len(persona_ids) > 0 else None
        document_ids = (
            [uuid.UUID(d) for d in data.documentIds] if data.documentIds else None
        )
        field_ids = [uuid.UUID(f) for f in data.fieldIds] if data.fieldIds else None

        # Get profile_id from sid lookup (O(1) Redis lookup)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await scenario_generation_error(
                ScenarioGenerationErrorPayload(
                    success=False,
                    message="Profile not found. Please reconnect.",
                    trace_id=trace_id,
                ),
                room=sid,
            )
            await _emit_scenario_error_with_simulation_context(
                sid=sid,
                message="Profile not found. Please reconnect.",
                attempt_id=data.attemptId,
                simulation_id=data.simulationId,
            )
            return
        profile_id = uuid.UUID(profile_id_str)

        # Filter out empty lists
        if document_ids and len(document_ids) == 0:
            document_ids = None

        try:
            async with get_db_connection() as conn:
                # Emit start event
                await scenario_generation_progress(
                    ScenarioGenerationProgressPayload(
                        type="start",
                        message="Starting scenario generation",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )

            # Step 1: Randomize missing values first
            scenario_id_uuid = uuid.UUID(data.scenarioId) if data.scenarioId else None

            # Determine which values need randomization based on randomizeType
            if data.randomizeType:
                # Selective randomization mode
                if data.randomizeType == "persona":
                    needs_persona = True
                    needs_documents = False
                    needs_fields = False
                elif data.randomizeType == "document":
                    needs_persona = False
                    needs_documents = True
                    needs_fields = False
                elif data.randomizeType == "parameters":
                    needs_persona = False
                    needs_documents = False
                    needs_fields = True
                elif data.randomizeType.startswith("parameter_"):
                    # Extract parameter ID for selective parameter randomization
                    param_id_str = data.randomizeType.replace("parameter_", "")
                    parameter_id_to_randomize = None
                    try:
                        parameter_id_to_randomize = (
                            uuid.UUID(param_id_str) if param_id_str else None
                        )
                    except (ValueError, TypeError):
                        parameter_id_to_randomize = None
                    needs_persona = False
                    needs_documents = False
                    needs_fields = True
                else:  # "all" or None
                    needs_persona = not persona_ids or len(persona_ids) == 0
                    needs_documents = not document_ids or len(document_ids) == 0
                    needs_fields = not field_ids or len(field_ids) == 0
                    parameter_id_to_randomize = None
            else:
                # Default: randomize missing values
                needs_persona = not persona_ids or len(persona_ids) == 0
                needs_documents = not document_ids or len(document_ids) == 0
                needs_fields = not field_ids or len(field_ids) == 0
                parameter_id_to_randomize = None

            randomized_selections = None
            if needs_persona or needs_documents or needs_fields:
                # Extract parameter_id if needed for selective parameter randomization
                if data.randomizeType and data.randomizeType.startswith("parameter_"):
                    param_id_str = data.randomizeType.replace("parameter_", "")
                    try:
                        parameter_id_to_randomize = (
                            uuid.UUID(param_id_str) if param_id_str else None
                        )
                    except (ValueError, TypeError):
                        parameter_id_to_randomize = None
                else:
                    parameter_id_to_randomize = None

                randomized_selections = await _randomize_missing_scenario_values(
                    conn=conn,
                    scenario_id=scenario_id_uuid,
                    profile_id=profile_id,
                    department_id=department_id,
                    existing_persona_ids=persona_ids if not needs_persona else None,
                    existing_document_ids=document_ids if not needs_documents else None,
                    existing_field_ids=field_ids if not needs_fields else None,
                    randomize_type=data.randomizeType,
                    parameter_id_to_randomize=parameter_id_to_randomize,
                )

                # Update values with randomized selections
                if randomized_selections.get("persona_ids") and needs_persona:
                    persona_ids = randomized_selections["persona_ids"]
                    persona_id = persona_ids[0] if persona_ids else None
                if randomized_selections.get("document_ids") and needs_documents:
                    document_ids = randomized_selections["document_ids"]
                if randomized_selections.get("field_ids") and needs_fields:
                    field_ids = randomized_selections["field_ids"]
                # Update department_id if it was randomized
                if randomized_selections.get("department_id"):
                    department_id = randomized_selections["department_id"]

                # Link randomized selections to scenario if scenarioId is provided
                if scenario_id_uuid:
                    # Link persona
                    if randomized_selections.get("persona_ids"):
                        sql = load_sql(
                            "app/sql/v4/scenario/insert_scenario_persona_link.sql"
                        )
                        for persona_id_val in randomized_selections["persona_ids"]:
                            await conn.execute(
                                sql, scenario_id_uuid, persona_id_val, True
                            )

                    # Link documents
                    if randomized_selections.get("document_ids"):
                        sql = load_sql(
                            "app/sql/v4/scenario/insert_scenario_document_link.sql"
                        )
                        for doc_id_val in randomized_selections["document_ids"]:
                            await conn.execute(sql, scenario_id_uuid, doc_id_val, True)

                    # Link parameters (field_ids are parameter_item_ids)
                    if randomized_selections.get("field_ids"):
                        sql = load_sql(
                            "app/sql/v4/scenario/insert_scenario_parameter_link.sql"
                        )
                        for field_id_val in randomized_selections["field_ids"]:
                            await conn.execute(
                                sql, scenario_id_uuid, field_id_val, True
                            )

                    # Link department
                    if randomized_selections.get("department_id"):
                        sql = load_sql(
                            "app/sql/v4/scenario/insert_scenario_department_link.sql"
                        )
                        await conn.execute(
                            sql,
                            scenario_id_uuid,
                            randomized_selections["department_id"],
                            True,
                        )
                # Emit randomization complete event
                await sio.emit(
                    "scenario_randomize_complete",
                    {
                        "success": True,
                        "randomized_selections": {
                            "personaIds": (
                                [str(p) for p in randomized_selections["persona_ids"]]
                                if randomized_selections.get("persona_ids")
                                else None
                            ),
                            "documentIds": (
                                [str(d) for d in randomized_selections["document_ids"]]
                                if randomized_selections.get("document_ids")
                                else None
                            ),
                            "fieldIds": (
                                [str(f) for f in randomized_selections["field_ids"]]
                                if randomized_selections.get("field_ids")
                                else None
                            ),
                        },
                        "message": "Randomized missing scenario values",
                    },
                    room=sid,
                )
            # If skipGeneration is True, stop here after randomization
            if data.skipGeneration:
                await scenario_generation_progress(
                    ScenarioGenerationProgressPayload(
                        type="complete",
                        message="Scenario randomization completed",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                # Log activity
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="scenarios.randomized",
                        template="{{ actor.name }} randomized scenario selections",
                        context={"randomize_type": data.randomizeType or "all"},
                        endpoint="/socket/v4/scenarios/randomize",
                        error=False,
                    )
                except Exception:
                    pass
                return

            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            # Pattern: All AI operations use atomic context+run creation SQL files
            # See WEBSOCKET_STANDARDS.md for details
            # Scenario Agent ID should be provided in payload (UI filters and selects appropriate agent)
            scenario_agent_id = (
                uuid.UUID(data.scenarioAgentId)
                if hasattr(data, "scenarioAgentId") and data.scenarioAgentId
                else None
            )

            if not scenario_agent_id:
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message="Scenario Agent ID is required for scenario generation",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Extract image agent ID (required when images are enabled)
            image_agent_id = None
            if hasattr(data, "imageAgentId") and data.imageAgentId:
                try:
                    image_agent_id = uuid.UUID(data.imageAgentId)
                except (ValueError, TypeError):
                    await scenario_generation_error(
                        ScenarioGenerationErrorPayload(
                            success=False,
                            message=f"Invalid imageAgentId provided: {data.imageAgentId}",
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return

            try:
                # Get context AND create run in single atomic transaction
                # This validates rate limits and creates run atomically
                # Use execute_sql_typed() - auto-detects function
                params = GetScenarioRunContextAndCreateRunSqlParams(
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                    agent_id=scenario_agent_id,
                    group_id=None,  # NULL for new group
                    persona_id=persona_id,
                    document_ids=document_ids if document_ids else None,
                    parameter_item_ids=field_ids if field_ids else None,
                )
                result = cast(
                    GetScenarioRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await scenario_generation_error(
                        ScenarioGenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize scenario generation: {str(e)}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            if not result:
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message=f"No scenario agent configured for department {data.departmentId}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # result.group_id and result.trace_id come from groups table
            group_id = result.group_id
            if not trace_id:
                trace_id = result.trace_id  # From groups.trace_id

            # Documents, parameter_items, and document_templates are now composite type arrays
            # No JSON parsing needed - they're already Pydantic models
            documents = result.documents if result.documents else []
            parameter_items = result.parameter_items if result.parameter_items else []
            document_templates = (
                result.document_templates if result.document_templates else []
            )

            agent_role = result.agent_role or "scenario"

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Load agent tools from database
            from app.sql.types import GetAgentToolsSqlRow

            agent_id_uuid = uuid.UUID(result.agent_id)
            # Function returns multiple rows, so we call it directly with fetch()
            function_call_sql = 'SELECT * FROM "public"."socket_get_agent_tools_v4"($1)'
            rows = await conn.fetch(function_call_sql, agent_id_uuid)
            agent_tools_config = [
                GetAgentToolsSqlRow.model_validate(dict(row)).model_dump()
                for row in rows
            ]
            # Create mapping of tool name -> tool config for quick lookup
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Convert composite types to dicts for compatibility with existing code
            context = {
                "agent_id": result.agent_id,
                "agent_name": result.agent_name,
                "agent_role": agent_role,
                "system_prompt": result.system_prompt,
                "temperature": float(result.temperature)
                if result.temperature is not None
                else 0.0,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "model_name": result.model_name,
                "custom_model": result.custom_model,
                "provider_id": result.provider_id,
                "provider_name": result.provider_name,
                "base_url": result.base_url,
                "api_key": result.api_key,
                "persona": {
                    "id": result.persona_id,
                    "name": result.persona_name,
                    "description": result.persona_description,
                }
                if result.persona_id
                else None,
                "documents": [
                    {
                        "id": doc.id,
                        "name": doc.name,
                        "file_path": doc.file_path,
                        "mime_type": doc.mime_type,
                        "template": doc.template,
                        "schema_id": str(doc.schema_id) if doc.schema_id else None,
                    }
                    for doc in documents
                ],
                "parameter_items": [
                    {
                        "item_name": item.item_name,
                        "item_description": item.item_description,
                        "param_name": item.param_name,
                        "param_description": item.param_description,
                    }
                    for item in parameter_items
                ],
                "document_templates": [
                    {
                        "document_id": dt.document_id,
                        "document_name": dt.document_name,
                        "document_description": dt.document_description,
                        "classify_agent_id": dt.classify_agent_id,
                        "document_agent_id": dt.document_agent_id,
                        "schema_id": str(dt.schema_id) if dt.schema_id else None,
                        "template_upload_id": dt.template_upload_id,
                        "template_file_path": dt.template_file_path,
                    }
                    for dt in document_templates
                ],
                "req_per_day": result.req_per_day,
                "runs_today_count": result.runs_today_count,
                "earliest_run_created_at": result.earliest_run_created_at,
                # Theme tokens for Jinja2 rendering
                "theme_primitives": {
                    "primary": result.primary_color or "#000000",
                    "accent": result.accent or "#000000",
                    "background": result.background or "#ffffff",
                    "surface": result.surface or "#ffffff",
                    "success": result.success or "#10b981",
                    "warning": result.warning or "#f59e0b",
                    "error": result.error or "#ef4444",
                    "sidebarBackground": result.sidebar_background or "#ffffff",
                    "sidebarPrimary": result.sidebar_primary or "#000000",
                    "chart1": result.chart1 or "#8884d8",
                    "chart2": result.chart2 or "#82ca9d",
                    "chart3": result.chart3 or "#ffc658",
                    "chart4": result.chart4 or "#ff7300",
                    "chart5": result.chart5 or "#0088fe",
                },
            }

            # Format persona info if persona was provided
            if persona_id is None or context["persona"] is None:
                persona_info = None
                show_images = False
            else:
                persona_data = context["persona"]
                persona_info = {
                    "role": "user",
                    "content": f"This is the profile of the student: Name: {persona_data['name']} Description: {persona_data.get('description', '')}",
                }
                show_images = False

            # Format document info if documents were provided
            if not document_ids or len(document_ids) == 0:
                document_info = None
            else:
                document_info = format_document_info(context["documents"], show_images)

            # Format parameter item info if parameter items were provided
            if not field_ids or len(field_ids) == 0:
                field_info = None
            else:
                parameter_items = context["parameter_items"]
                if not parameter_items:
                    field_info = {
                        "role": "user",
                        "content": "No parameter items found.",
                    }
                else:
                    formatted_items = []
                    for row in parameter_items:
                        formatted_item = (
                            f"This is the {row['param_name']} ({row.get('param_description', '')}) for this chat: {row['item_name']}. "
                            f"Description: {row.get('item_description', '')}."
                        )
                        formatted_items.append(formatted_item)

                    content = (
                        "The following is the parameter item information:\n"
                        + "\n".join(formatted_items)
                    )
                    field_info = {
                        "role": "user",
                        "content": content,
                    }

            # Determine which tools to enable based on agent role
            # group_id already extracted above from context_row

            # Determine tool availability based on agent role
            # Base 'scenario' role supports all tools (backward compatibility)
            # Fine-grained roles indicate specific capabilities
            agent_role_str = str(agent_role).lower()
            # Use flags from payload (4 core booleans)
            objectives_enabled = (
                hasattr(data, "objectivesEnabled")
                and data.objectivesEnabled
                and (
                    agent_role_str == "scenario"  # Base role supports all
                    or "objectives" in agent_role_str
                )
            )
            images_enabled = (
                hasattr(data, "imagesEnabled")
                and data.imagesEnabled
                and (
                    agent_role_str == "scenario"  # Base role supports all
                    or "image" in agent_role_str
                )
            )
            # Documents enabled if agent supports templates AND template documents exist
            # (inferred from document presence, not a flag)
            has_template_documents = bool(
                context["document_templates"] and len(context["document_templates"]) > 0
            )
            documents_enabled = has_template_documents and (
                agent_role_str == "scenario"  # Base role supports all
                or "templates" in agent_role_str
            )
            # Video and questions enabled via flags in payload
            video_enabled = (
                hasattr(data, "videoEnabled")
                and data.videoEnabled
                and hasattr(data, "videoAgentId")
                and data.videoAgentId
            )
            questions_enabled = (
                hasattr(data, "questionsEnabled") and data.questionsEnabled
            )
            # profile_id is required (validated above)
            final_profile_id = profile_id

            # Create scenario generation tools inline
            scenario_tools: list[Tool] = []
            primary_id = trace_id or (str(group_id) if group_id else None)

            # Set image generation context before creating tools (if images enabled)
            # Require image_agent_id when images are enabled
            if images_enabled:
                if not image_agent_id:
                    await scenario_generation_error(
                        ScenarioGenerationErrorPayload(
                            success=False,
                            message="imageAgentId is required when image generation is enabled",
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return

                if not final_profile_id:
                    await scenario_generation_error(
                        ScenarioGenerationErrorPayload(
                            success=False,
                            message="profile_id is required for image generation",
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return

                # Image generation context is now passed directly to background tasks (no-op removed)

            # 1. Statement Tool (always included, replaces title_and_description)
            # Build signature from database config if available
            statement_config = tool_config_map.get("create_statement")
            if statement_config:
                statement_desc = statement_config.get("argument_descriptions", {}).get(
                    "statement",
                    "The problem statement for the scenario (1-2 sentences)",
                )
            else:
                statement_desc = (
                    "The problem statement for the scenario (1-2 sentences)"
                )

            async def create_statement(
                statement: str = Field(description=statement_desc),
            ) -> str:
                """Create the problem statement for the scenario.

                The problem statement must be exactly 1-2 sentences and should:
                - Subtly show the student's persona without stating it directly
                - Incorporate environmental parameters (crowdedness, intensity, time, deadline, location)
                - Focus on the course topic from the documents
                - Build a scene that shows, not tells

                Args:
                    statement: 1-2 sentence problem statement

                Returns:
                    Confirmation message
                """
                # Emit to internal bus for problem statement creation
                await internal_sio.emit(
                    "scenario_tool_problem_statement",
                    {
                        "sid": sid,
                        "trace_id": trace_id,
                        "title": "",  # No longer used, but kept for compatibility
                        "description": statement,
                        "scenario_id": data.scenarioId if data.scenarioId else None,
                    },
                )

                return "Created problem statement successfully"

            scenario_tools.append(function_tool(create_statement))
            # 1.5. Title Tool (always included)
            title_config = tool_config_map.get("create_title")
            if title_config:
                title_desc = title_config.get("argument_descriptions", {}).get(
                    "title",
                    "A descriptive title for this content item",
                )
            else:
                title_desc = "A descriptive title for this content item"

            async def create_title(
                title: str = Field(description=title_desc),
            ) -> str:
                """Create a descriptive title for this scenario.

                The title should be concise and descriptive (5-10 words).

                Args:
                    title: Short, descriptive title for the scenario

                Returns:
                    Confirmation message
                """
                # Emit to internal bus for title creation
                await internal_sio.emit(
                    "scenario_tool_title",
                    {
                        "sid": sid,
                        "trace_id": trace_id,
                        "title": title,
                        "scenario_id": data.scenarioId if data.scenarioId else None,
                    },
                )
                return "Created title successfully"

            scenario_tools.append(function_tool(create_title))
            # 2. Objectives Tool (if enabled)
            if objectives_enabled:
                # Build signature from database config if available
                objectives_config = tool_config_map.get("create_objective")
                if objectives_config:
                    objectives_desc = objectives_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "objectives",
                        "List of 1-3 specific learning objectives that GTAs should achieve in this scenario",
                    )
                else:
                    objectives_desc = "List of 1-3 specific learning objectives that GTAs should achieve in this scenario"

                async def set_objectives(
                    objectives: list[str] = Field(description=objectives_desc),
                ) -> str:
                    """Set the learning objectives for this scenario.

                    Objectives should:
                    - Be specific and measurable
                    - Relate to the skills needed to handle this particular scenario
                    - Focus on pedagogical skills, communication, or subject matter knowledge
                    - Be achievable within a single chat interaction

                    Examples:
                    - "Demonstrate active listening by paraphrasing the student's concerns"
                    - "Break down complex concepts into understandable chunks"
                    - "Manage time effectively while addressing the student's emotional state"

                    Args:
                        objectives: List of 1-3 learning objectives (maximum 3)

                    Returns:
                        Confirmation message
                    """
                    # Limit objectives based on objectivesMax if provided, otherwise max 3
                    max_objectives = (
                        min(data.objectivesMax, 5)
                        if hasattr(data, "objectivesMax")
                        and data.objectivesMax is not None
                        else 3
                    )
                    objectives = objectives[:max_objectives]

                    if len(objectives) < 1 or len(objectives) > max_objectives:
                        # Validation failed - skip creation
                        return (
                            f"Objectives count must be between 1 and {max_objectives}"
                        )

                    # Emit to internal bus for objectives creation
                    await internal_sio.emit(
                        "scenario_tool_objectives",
                        {
                            "sid": sid,
                            "trace_id": trace_id,
                            "objectives": objectives,
                            "scenario_id": data.scenarioId if data.scenarioId else None,
                        },
                    )

                    return f"Set {len(objectives)} learning objectives successfully"

                scenario_tools.append(function_tool(set_objectives))

            # 3. Dynamic Document Tool (if enabled)
            if documents_enabled:
                if not final_profile_id:
                    pass  # Skip document tool if no profile
                else:
                    # Extract template schema from document_templates if available
                    template_schema: dict[str, Any] | None = None
                    if document_templates and len(document_templates) > 0:
                        # Use the first template's schema (typically there's only one)
                        first_template = document_templates[0]
                        schema_id_str = first_template.get("schema_id")
                        if schema_id_str:
                            try:
                                schema_id_uuid = uuid.UUID(schema_id_str)
                                # Get schema tree from database using existing conn
                                template_schema = await get_schema_tree(
                                    conn, schema_id_uuid
                                )
                            except (ValueError, Exception):
                                template_schema = None

                    # Core implementation function that processes template args
                    async def _create_document_impl(
                        template_args_dict: dict[str, Any],
                    ) -> str:
                        """Internal implementation that processes template args dict."""
                        if not document_templates or len(document_templates) == 0:
                            return "Error: No template documents are available for dynamic creation."

                        # Use the first available template (typically there will be only one)
                        parent_template = document_templates[0]
                        parent_document_id = parent_template.get("document_id", "")
                        template_file_path = parent_template.get(
                            "template_file_path", ""
                        )
                        parent_name = parent_template.get("document_name", "")
                        parent_description = parent_template.get(
                            "document_description", ""
                        )
                        classify_agent_id = parent_template.get("classify_agent_id", "")
                        document_agent_id = parent_template.get("document_agent_id", "")

                        if not parent_document_id:
                            return "Error: Could not determine parent template document ID."

                        if not template_file_path:
                            return (
                                "Error: Parent template document has no template file."
                            )

                        # Read template HTML file (no SQL needed - file_path already in context)
                        full_template_path = UPLOAD_FOLDER / template_file_path

                        if not full_template_path.exists():
                            return f"Error: Template file not found at {template_file_path}"

                        with open(full_template_path, encoding="utf-8") as f:
                            template_html = f.read()

                        # Derive theme tokens from primitives (already in context)
                        theme_primitives = ThemePrimitives(
                            **context["theme_primitives"]
                        )
                        theme_tokens = derive_theme_tokens(theme_primitives)

                        # Render template HTML with Jinja2
                        try:
                            rendered_html = render_template(
                                html=template_html,
                                context=template_args_dict,
                                theme_tokens=theme_tokens,
                            )
                        except Exception as e:
                            error_msg = f"Error rendering template: {str(e)}"
                            return error_msg

                        # Save rendered HTML to file
                        upload_uuid = uuid.uuid4()
                        file_path = f"{upload_uuid}.html"
                        full_path = UPLOAD_FOLDER / file_path

                        # Ensure uploads directory exists
                        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

                        # Write rendered HTML to file
                        with open(full_path, "w", encoding="utf-8") as f:
                            f.write(rendered_html)

                        file_size = len(rendered_html.encode("utf-8"))
                        child_name = f"{parent_name} (Dynamic)"
                        child_description = parent_description or ""

                        # Emit to internal bus for document creation completion
                        await internal_sio.emit(
                            "scenario_tool_document",
                            {
                                "sid": sid,
                                "trace_id": trace_id,
                                "parent_document_id": parent_document_id,
                                "file_path": file_path,
                                "mime_type": "text/html",
                                "file_size": file_size,
                                "child_name": child_name,
                                "child_description": child_description,
                                "classify_agent_id": classify_agent_id,
                                "document_agent_id": document_agent_id,
                                "scenario_id": data.scenarioId
                                if data.scenarioId
                                else None,
                            },
                        )
                        return "Dynamic document created successfully. Template rendered and saved."

                    # If we have a template schema, create a function with individual parameters
                    if template_schema:
                        TemplateArgsModel: type[BaseModel] | None = None
                        try:
                            TemplateArgsModel = _build_template_model(template_schema)
                        except Exception:
                            TemplateArgsModel = None

                        if template_schema and TemplateArgsModel:
                            fields_data = template_schema.get("fields", [])
                            if fields_data:
                                # Build function signature with individual parameters
                                # We'll use exec to create a function with dynamic signature
                                param_definitions = []
                                param_names = []

                                for field in fields_data:
                                    field_name = field.get("name")
                                    if not field_name:
                                        continue

                                    field_type = field.get("type", "string")
                                    required = field.get("required", False)
                                    description = field.get("description", "")
                                    placeholder = field.get("placeholder", "")

                                    # Build description with placeholder if available
                                    field_description = description
                                    if placeholder:
                                        field_description = (
                                            f"{description} (Example: {placeholder})"
                                            if description
                                            else f"Example: {placeholder}"
                                        )

                                    # Map field types to Python types for type hints
                                    python_type_str = "str"
                                    if field_type == "number":
                                        python_type_str = "float"
                                    elif field_type == "boolean":
                                        python_type_str = "bool"
                                    elif field_type == "array":
                                        python_type_str = "list[str]"  # Default to list[str] for arrays

                                    param_names.append(field_name)

                                    # Create Field annotation
                                    if required:
                                        param_def = f"{field_name}: {python_type_str} = Field(..., description={repr(field_description)})"
                                    else:
                                        param_def = f"{field_name}: {python_type_str} | None = Field(default=None, description={repr(field_description)})"

                                    param_definitions.append(param_def)

                                # Build function code
                                params_str = ", ".join(param_definitions)

                                # Create function body that collects parameters into dict
                                # Indent with 4 spaces to match function body indentation
                                collect_dict_code = "    template_args_dict = {\n"
                                for field_name in param_names:
                                    collect_dict_code += (
                                        f"        {repr(field_name)}: {field_name},\n"
                                    )
                                collect_dict_code += "    }\n"

                                # Remove None values for optional fields
                                collect_dict_code += (
                                    "    # Remove None values for optional fields\n"
                                )
                                collect_dict_code += "    template_args_dict = {k: v for k, v in template_args_dict.items() if v is not None}\n"

                                func_code = f"""async def create_document({params_str}) -> str:
    \"\"\"Create a dynamic child document from the available template document.

    This tool renders the available template document with provided template argument values
    and creates a new child document (not a template) that replaces the parent in the scenario.

    You do not need to specify the parent document ID - it will be automatically inferred.
    Provide the template argument values as specified by the template schema.

    Args:
        {chr(10).join(f"        {name}: Template argument value" for name in param_names)}

    Returns:
        Confirmation message
    \"\"\"
{collect_dict_code}
    return await _create_document_impl(template_args_dict)
"""

                                # Execute in custom namespace that includes closure variable
                                # The key issue is that exec() doesn't preserve closure access to local functions.
                                # We need to ensure _create_document_impl is accessible when the function executes.

                                # Capture _create_document_impl in outer scope
                                impl_ref = _create_document_impl

                                # Modify function code to reference the captured implementation
                                func_code_with_closure = func_code.replace(
                                    "return await _create_document_impl(template_args_dict)",
                                    "return await _impl_ref(template_args_dict)",
                                )

                                import builtins

                                # Create namespace with the captured implementation function
                                exec_namespace = {
                                    "__builtins__": builtins,
                                    "Field": Field,
                                    "_impl_ref": impl_ref,  # Captured reference to _create_document_impl
                                    "str": str,
                                    "float": float,
                                    "bool": bool,
                                    "list": list,
                                }

                                # Execute function code in the custom namespace
                                # Using exec_namespace as both globals and locals ensures the function
                                # has access to _impl_ref when it's called later
                                exec(
                                    func_code_with_closure,
                                    exec_namespace,
                                    exec_namespace,
                                )
                                create_document_func = exec_namespace["create_document"]

                                scenario_tools.append(
                                    function_tool(create_document_func)
                                )  # type: ignore
                            else:
                                # Fallback: create function with dict parameter
                                async def create_document_fallback(
                                    template_args: dict[str, Any],
                                ) -> str:
                                    """Create a dynamic child document from the available template document.

                                    This tool renders the available template document with provided template argument values
                                    and creates a new child document (not a template) that replaces the parent in the scenario.

                                    You do not need to specify the parent document ID - it will be automatically inferred.
                                    Provide the template argument values as a dictionary matching the template schema.

                                    Args:
                                        template_args: Dictionary of template argument values

                                    Returns:
                                        Confirmation message
                                    """
                                    return await _create_document_impl(template_args)

                                scenario_tools.append(
                                    function_tool(create_document_fallback)
                                )  # type: ignore[arg-type]
                        else:
                            # Fallback: create function with dict parameter
                            async def create_document_fallback(
                                template_args: dict[str, Any],
                            ) -> str:
                                """Create a dynamic child document from the available template document.

                                This tool renders the available template document with provided template argument values
                                and creates a new child document (not a template) that replaces the parent in the scenario.

                                You do not need to specify the parent document ID - it will be automatically inferred.
                                Provide the template argument values as a dictionary matching the template schema.

                                Args:
                                    template_args: Dictionary of template argument values

                                Returns:
                                    Confirmation message
                                """
                                return await _create_document_impl(template_args)

                            scenario_tools.append(
                                function_tool(create_document_fallback)
                            )  # type: ignore[arg-type]
                    else:
                        # Fallback: create function with dict parameter (for backward compatibility)
                        # This is handled in the main create_document function above
                        pass

                        async def create_document_fallback(
                            template_args: dict[str, Any],
                        ) -> str:
                            """Create a dynamic child document from the available template document.

                            This tool renders the available template document with provided template argument values
                            and creates a new child document (not a template) that replaces the parent in the scenario.

                            You do not need to specify the parent document ID - it will be automatically inferred.
                            Provide the template argument values as a dictionary matching the template schema.

                            Args:
                                template_args: Dictionary of template argument values

                            Returns:
                                Confirmation message
                            """
                            return await _create_document_impl(template_args)

                        scenario_tools.append(function_tool(create_document_fallback))  # type: ignore[arg-type]

            # 4. Video Generation Tool (if enabled)
            if video_enabled:
                if not hasattr(data, "videoAgentId") or not data.videoAgentId:
                    pass  # Skip video tool if no agent ID
                else:
                    video_agent_id = uuid.UUID(data.videoAgentId)

                    # Build signature from database config if available
                    video_config = tool_config_map.get("create_video")
                    if video_config:
                        prompt_desc = video_config.get("argument_descriptions", {}).get(
                            "prompt",
                            "Detailed prompt describing the video to generate. Include specific details about the scenario, setting, characters, and actions.",
                        )
                        image_ids_desc = video_config.get(
                            "argument_descriptions", {}
                        ).get(
                            "image_ids",
                            "Optional list of image IDs to use as reference for video generation. If provided, video generation will wait for these images to be ready.",
                        )
                    else:
                        prompt_desc = "Detailed prompt describing the video to generate. Include specific details about the scenario, setting, characters, and actions."
                        image_ids_desc = "Optional list of image IDs to use as reference for video generation. If provided, video generation will wait for these images to be ready."

                    async def create_video(
                        prompt: str = Field(description=prompt_desc),
                        image_ids: list[str] | None = Field(
                            default=None, description=image_ids_desc
                        ),
                    ) -> str:
                        """Generate a video for this scenario.

                        The video should visually represent the scenario described in the problem statement.
                        Include details about the setting, characters, and key actions.

                        Args:
                            prompt: Detailed prompt for video generation
                            image_ids: Optional list of image IDs to reference

                        Returns:
                            Confirmation message
                        """
                        if not data.scenarioId:
                            return "Video generation skipped because scenarioId was not provided."
                        # Emit to internal bus for video generation
                        await internal_sio.emit(
                            "scenario_tool_video",
                            {
                                "sid": sid,
                                "trace_id": trace_id,
                                "prompt": prompt,
                                "scenario_id": data.scenarioId
                                if data.scenarioId
                                else None,
                                "video_id": None,  # Will be created
                                "image_ids": image_ids,
                                "agent_id": str(video_agent_id),
                                "department_id": str(department_id)
                                if department_id
                                else None,
                            },
                        )

                        return "Video generation started successfully"

                    scenario_tools.append(function_tool(create_video))

            # 5. Questions Generation Tool (if enabled)
            if questions_enabled:
                # Build signature from database config if available
                question_config = tool_config_map.get("create_question")
                if questions_config:
                    questions_desc = questions_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "questions",
                        "List of questions to create. Each question should be a dict with 'question_text' (string), 'allow_multiple' (boolean), and 'options' (list of dicts with 'option_text' and 'is_correct' boolean). Example: [{'question_text': 'What is the main issue?', 'allow_multiple': False, 'options': [{'option_text': 'Option A', 'is_correct': True}, {'option_text': 'Option B', 'is_correct': False}]}]",
                    )
                    timestamps_desc = questions_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "question_timestamps",
                        "Optional dictionary mapping question indices (as strings: '0', '1', '2', etc.) to lists of timestamps (in seconds) where each question should appear in the video. Only used if video is also generated. Example: {'0': [10, 30], '1': [45]}",
                    )
                else:
                    questions_desc = "List of questions to create. Each question should be a dict with 'question_text' (string), 'allow_multiple' (boolean), and 'options' (list of dicts with 'option_text' and 'is_correct' boolean). Example: [{'question_text': 'What is the main issue?', 'allow_multiple': False, 'options': [{'option_text': 'Option A', 'is_correct': True}, {'option_text': 'Option B', 'is_correct': False}]}]"
                    timestamps_desc = "Optional dictionary mapping question indices (as strings: '0', '1', '2', etc.) to lists of timestamps (in seconds) where each question should appear in the video. Only used if video is also generated. Example: {'0': [10, 30], '1': [45]}"

                async def create_question(
                    question_text: str = Field(description=question_text_desc),
                    allow_multiple: bool = Field(description=allow_multiple_desc),
                    options: list[dict[str, Any]] | None = Field(
                        default=None, description=options_desc
                    ),
                    question_timestamp: int | None = Field(
                        default=None, description=question_timestamp_desc
                    ),
                ) -> str:
                    """Create a question for this scenario. Call multiple times to create multiple questions.

                    Questions should test understanding of the scenario and help GTAs practice
                    their responses. Each question should have clear options with one or more
                    correct answers.

                    Args:
                        question_text: The question text
                        allow_multiple: Whether multiple answers are allowed
                        options: List of option dicts with option_text, type, is_correct
                        question_timestamp: Optional timestamp in seconds for video

                    Returns:
                        Confirmation message with total count
                    """
                    if "questions" not in scenario_results:
                        scenario_results["questions"] = []
                    if "question_timestamps" not in scenario_results:
                        scenario_results["question_timestamps"] = {}

                    question_dict = {
                        "question_text": question_text,
                        "allow_multiple": allow_multiple,
                        "options": options or [],
                    }
                    scenario_results["questions"].append(question_dict)

                    if question_timestamp is not None:
                        question_index = len(scenario_results["questions"]) - 1
                        if (
                            str(question_index)
                            not in scenario_results["question_timestamps"]
                        ):
                            scenario_results["question_timestamps"][
                                str(question_index)
                            ] = []
                        scenario_results["question_timestamps"][
                            str(question_index)
                        ].append(question_timestamp)

                    current_count = len(scenario_results["questions"])

                    # Get video_id if video was generated (from context or previous tool results)
                    video_id = (
                        None  # TODO: Extract from previous tool results if available
                    )

                    # Emit to internal bus for question creation (accumulate, emit all at end if needed)
                    # For now, emit each question individually (can be optimized later)
                    await internal_sio.emit(
                        "scenario_tool_questions",
                        {
                            "sid": sid,
                            "trace_id": trace_id,
                            "questions": scenario_results["questions"],
                            "scenario_id": data.scenarioId if data.scenarioId else None,
                            "video_id": video_id,
                            "question_timestamps": scenario_results[
                                "question_timestamps"
                            ],
                        },
                    )

                    return f"Created question successfully (total: {current_count})"

                    scenario_tools.append(function_tool(create_question))

            # 6. Image Generation Tool (if enabled)
            if images_enabled:
                if not final_profile_id:
                    pass  # Skip image tool if no profile
                else:
                    # Build signature from database config if available
                    image_config = tool_config_map.get("create_image")
                    if image_config:
                        name_desc = image_config.get("argument_descriptions", {}).get(
                            "name", "Descriptive name for the generated image"
                        )
                        prompt_desc = image_config.get("argument_descriptions", {}).get(
                            "prompt",
                            "Detailed, descriptive prompt for image generation",
                        )
                    else:
                        name_desc = "Descriptive name for the generated image"
                        prompt_desc = (
                            "Detailed, descriptive prompt for image generation"
                        )

                    async def create_image(
                        name: str = Field(description=name_desc),
                        prompt: str = Field(description=prompt_desc),
                    ) -> str:
                        """Generate an image from a detailed prompt.

                        This tool creates an image using AI image generation based on your detailed prompt.
                        The image will be saved and linked to the scenario after generation completes.

                        Args:
                            name: Descriptive name for the image (required)
                            prompt: Detailed, descriptive prompt describing what the image should look like (required)

                        Returns:
                            Confirmation message
                        """
                        # Emit to internal bus for image creation
                        # Use image_agent_id (set from payload) instead of scenario agent_id
                        await internal_sio.emit(
                            "scenario_tool_image",
                            {
                                "sid": sid,
                                "trace_id": trace_id,
                                "name": name,
                                "prompt": prompt,
                                "agent_id": str(
                                    image_agent_id
                                ),  # Use image agent ID for image generation
                                "department_id": str(department_id)
                                if department_id
                                else None,
                                "profile_id": str(final_profile_id)
                                if final_profile_id
                                else None,
                                "scenario_id": data.scenarioId
                                if data.scenarioId
                                else None,
                            },
                        )

                        return f"Image generation initiated for '{name}'. Image will be created and linked when ready."

                    scenario_tools.append(function_tool(create_image))

            # Add debug info tool
            scenario_tools.append(debug_info_tool)

            # Create tool use behavior to check when all required tools are called
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                """Check if all required tools have been called.

                Required tools:
                - create_statement (always required, replaces title_description)
                - create_objective (if objectives_enabled, can be called multiple times)
                - create_document (if has_template_documents)
                """
                required_tools = ["create_statement"]
                if objectives_enabled:
                    required_tools.append("create_objective")
                if has_template_documents:
                    required_tools.append("create_document")

                # Check which tools have been called
                completed_tools = []

                for idx, result in enumerate(tool_results):
                    # Try multiple ways to get tool name (FunctionToolResult structure may vary)
                    tool_name = None

                    # Try direct attribute access (like hint agent)
                    if hasattr(result, "tool_name"):
                        tool_name = result.tool_name  # type: ignore[attr-defined]
                    # Try getattr as fallback
                    else:
                        tool_name = getattr(result, "tool_name", None)  # type: ignore[misc]
                        if tool_name:
                            pass  # tool_name already set
                        else:
                            tool_name = getattr(result, "name", None)  # type: ignore[misc]
                            if tool_name:
                                pass  # tool_name already set
                    # Try to get tool name from tool object if result has one
                    if not tool_name:
                        tool_obj = getattr(result, "tool", None)  # type: ignore[misc]
                        if tool_obj:
                            tool_name = getattr(tool_obj, "name", None)  # type: ignore[misc]
                    if tool_name and isinstance(tool_name, str):
                        # Normalize tool names to match required_tools
                        normalized_name = tool_name
                        if tool_name == "create_statement" or (
                            "statement" in tool_name.lower()
                            and (
                                "create" in tool_name.lower()
                                or "title" in tool_name.lower()
                                or "description" in tool_name.lower()
                            )
                        ):
                            normalized_name = "create_statement"
                        elif tool_name == "create_objective" or (
                            "objective" in tool_name.lower()
                            and "create" in tool_name.lower()
                        ):
                            normalized_name = "create_objective"
                        elif tool_name == "create_document" or (
                            "create" in tool_name.lower()
                            and "document" in tool_name.lower()
                        ):
                            normalized_name = "create_document"
                        elif tool_name == "create_image" or (
                            "image" in tool_name.lower()
                            and "create" in tool_name.lower()
                        ):
                            normalized_name = "create_image"
                        elif tool_name == "create_video" or (
                            "video" in tool_name.lower()
                            and "create" in tool_name.lower()
                        ):
                            normalized_name = "create_video"
                        elif tool_name == "create_question" or (
                            "question" in tool_name.lower()
                            and "create" in tool_name.lower()
                        ):
                            normalized_name = "create_question"
                        completed_tools.append(normalized_name)
                    # If tool_name not found, skip (no action needed)

                # Check if all required tools have been completed
                all_completed = all(tool in completed_tools for tool in required_tools)

                # If no tools detected but we have results, log what we got
                if len(tool_results) > 0 and len(completed_tools) == 0:
                    pass  # No tools detected, continue

                return ToolsToFinalOutputResult(is_final_output=all_completed)

            scenario_agent_generic = GenericAgent(
                agent_name=context["agent_name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider_name"],
                base_url=context["base_url"],
                api_key=context["api_key"],
                reasoning=context["reasoning"],
                tools=scenario_tools,
                parallel_tool_calls=False,
                tool_use_behavior=tool_use_behavior,
            )

            agent_instance = scenario_agent_generic.agent()

            input_items: list[TResponseInputItem | None] = [
                persona_info,
                document_info,
                field_info,
            ]

            clean_input_items = [item for item in input_items if item is not None]

            # Check rate limit
            profile_id_uuid = final_profile_id if final_profile_id else None
            if not profile_id_uuid:
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message="Profile not found. Please contact support.",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Rate limit validation and run creation are now handled in SQL
            # (get_scenario_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Track tool calls for this scenario run
            tool_calls_dict: dict[str, dict[str, Any]] = {}
            fake_id_to_real_id: dict[str, str] = {}
            tool_call_counter = 0

            # Run agent with streaming (message logging and token updates happen async via pricing endpoint)
            with trace(
                "Scenario Agent",
                group_id=str(group_id) if group_id else None,
                trace_id=trace_id,
            ):
                result_runner = Runner.run_streamed(
                    agent_instance,
                    input=clean_input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Store the result in active runs for potential cancellation
            from app.infra.v4.websocket.store_active_run import store_active_run

            await store_active_run(str(group_id) if group_id else sid, result_runner)

            try:
                # Process streaming events
                async for event in result_runner.stream_events():
                    # Check for raw_response_event and inspect data for tool call deltas
                    if hasattr(event, "type") and event.type == "raw_response_event":
                        event_data = getattr(event, "data", None)
                        if not event_data:
                            continue

                        event_data_type = (
                            getattr(event_data, "type", None)
                            if hasattr(event_data, "type")
                            else None
                        )

                        # Handle response.output_item.added to get tool name and item_id
                        if event_data_type == "response.output_item.added":
                            item = getattr(event_data, "item", None)
                            if item:
                                item_type = (
                                    getattr(item, "type", None)
                                    if hasattr(item, "type")
                                    else None
                                )
                                if item_type == "function_call":
                                    fake_item_id = getattr(item, "id", None)
                                    tool_name = getattr(item, "name", None)
                                    call_id = getattr(item, "call_id", None)

                                    if not fake_item_id:
                                        fake_item_id = getattr(
                                            event_data, "item_id", None
                                        )

                                    if call_id:
                                        real_item_id = call_id
                                    elif fake_item_id:
                                        tool_call_counter += 1
                                        real_item_id = f"scenario_{tool_call_counter}_{uuid.uuid4().hex[:8]}"
                                    else:
                                        continue

                                    if tool_name:
                                        if fake_item_id:
                                            fake_id_to_real_id[fake_item_id] = (
                                                real_item_id
                                            )

                                        if real_item_id not in tool_calls_dict:
                                            tool_calls_dict[real_item_id] = {
                                                "name": tool_name,
                                                "call_id": call_id,
                                                "fake_id": fake_item_id,
                                                "arguments_raw": "",
                                                "completed": False,
                                            }

                                            # Emit tool call start to progress
                                            await internal_sio.emit(
                                                "scenario_progress",
                                                {
                                                    "sid": sid,
                                                    "type": "tool_call_start",
                                                    "scenario_id": str(group_id)
                                                    if group_id
                                                    else None,
                                                    "run_id": str(model_run_id),
                                                    "tool_call_id": real_item_id,
                                                    "call_id": call_id or real_item_id,
                                                    "tool_name": tool_name,
                                                    "arguments_raw": "",
                                                },
                                            )

                        # Handle response.function_call_arguments.delta
                        if event_data_type == "response.function_call_arguments.delta":
                            fake_item_id = getattr(event_data, "item_id", None)
                            arguments_delta = getattr(event_data, "delta", None)
                            call_id = getattr(event_data, "call_id", None)

                            if not arguments_delta:
                                continue

                            if call_id:
                                delta_real_item_id = call_id
                            elif fake_item_id:
                                delta_real_item_id = fake_id_to_real_id.get(
                                    fake_item_id
                                )
                                if not delta_real_item_id:
                                    continue
                            else:
                                continue

                            tool_call_id = delta_real_item_id

                            if tool_call_id not in tool_calls_dict:
                                tool_calls_dict[tool_call_id] = {
                                    "name": None,
                                    "call_id": call_id,
                                    "fake_id": fake_item_id,
                                    "arguments_raw": "",
                                    "completed": False,
                                }

                            tool_call_state = tool_calls_dict[tool_call_id]

                            # Update tool name if we have call_id match
                            if not tool_call_state["name"] and call_id:
                                for tc_id, tc_state in tool_calls_dict.items():
                                    if tc_state.get(
                                        "call_id"
                                    ) == call_id and tc_state.get("name"):
                                        tool_call_state["name"] = tc_state["name"]
                                        break

                            tool_call_state["arguments_raw"] += arguments_delta

                            # Only emit progress if we have a tool name
                            if tool_call_state["name"]:
                                # Emit progress event
                                await internal_sio.emit(
                                    "scenario_progress",
                                    {
                                        "sid": sid,
                                        "type": "tool_call_progress",
                                        "scenario_id": str(group_id)
                                        if group_id
                                        else None,
                                        "run_id": str(model_run_id),
                                        "tool_call_id": tool_call_id,
                                        "call_id": call_id or tool_call_id,
                                        "tool_name": tool_call_state["name"],
                                        "arguments_raw": tool_call_state[
                                            "arguments_raw"
                                        ],
                                    },
                                )

                        # Handle tool call completion
                        if event_data_type == "response.output_item.done":
                            fake_item_id = getattr(event_data, "item_id", None)
                            item = getattr(event_data, "item", None)
                            call_id = None
                            if item:
                                call_id = getattr(item, "call_id", None)
                            if not call_id:
                                call_id = getattr(event_data, "call_id", None)

                            if call_id:
                                done_real_item_id = call_id
                            elif fake_item_id:
                                done_real_item_id = fake_id_to_real_id.get(fake_item_id)
                                if not done_real_item_id:
                                    continue
                            else:
                                continue

                            if done_real_item_id in tool_calls_dict:
                                tool_call_id = done_real_item_id
                                tool_call_state = tool_calls_dict[tool_call_id]

                                if tool_call_state.get("completed"):
                                    continue

                                tool_call_state["completed"] = True
                                tool_name = tool_call_state["name"]

                                # Parse final arguments
                                final_args = {}
                                try:
                                    import json

                                    if tool_call_state["arguments_raw"]:
                                        final_args = json.loads(
                                            tool_call_state["arguments_raw"]
                                        )
                                except json.JSONDecodeError:
                                    pass

                                # Emit completion event
                                await internal_sio.emit(
                                    "scenario_complete",
                                    {
                                        "sid": sid,
                                        "type": "tool_call_complete",
                                        "scenario_id": str(group_id)
                                        if group_id
                                        else None,
                                        "run_id": str(model_run_id),
                                        "tool_call_id": tool_call_id,
                                        "call_id": call_id or tool_call_id,
                                        "tool_name": tool_name,
                                        "final_content": str(final_args),
                                        "arguments_raw": tool_call_state[
                                            "arguments_raw"
                                        ],
                                    },
                                )

                                del tool_calls_dict[tool_call_id]

            except BaseException as stream_error:
                if isinstance(
                    stream_error,
                    (asyncio.CancelledError, KeyboardInterrupt, SystemExit),
                ):
                    raise
                raise
            except Exception:
                raise
            finally:
                # Clean up active run
                from app.infra.v4.websocket.remove_active_run import remove_active_run

                await remove_active_run(str(group_id) if group_id else sid)

            usage = result_runner.context_wrapper.usage
            assistant_output = getattr(result_runner, "final_output", None) or ""

            # Emit async pricing event via internal bus (non-blocking)
            # This handles token updates and message logging in background
            await internal_sio.emit(
                "log_run",
                {
                    "run_id": str(model_run_id),
                    "operation_type": "scenario",
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": context.get("system_prompt"),
                    "input_items": clean_input_items,  # Serialized TResponseInputItem list
                    "assistant_output": assistant_output,
                    "department_id": str(department_id) if department_id else None,
                },
            )

            # Emit run completion event (dispatched by complete.py)
            await internal_sio.emit(
                "scenario_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "scenario_id": str(group_id) if group_id else None,
                    "run_id": str(model_run_id),
                    "message": "Scenario generation completed. Check tool completion events for created resources.",
                    "trace_id": trace_id,
                },
            )

            # If simulation_id is present, emit advance event after generation completes
            # This allows scenario generation to trigger advance automatically when done
            if data.simulationId and data.scenarioId:
                await internal_sio.emit(
                    "simulation_advance",
                    {
                        "scenario_id": str(data.scenarioId),
                        "attempt_id": data.attemptId,
                        "profile_id": data.profileId,
                        "simulation_id": str(data.simulationId),
                    },
                )
            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="scenarios.generated",
                    template="{{ actor.name }} generated scenario",
                    context={"trace_id": trace_id},
                    endpoint="/socket/v4/scenarios/generate",
                    error=False,
                )
            except Exception:
                pass
        except RuntimeError:
            error_payload = ScenarioGenerationErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            )
            await scenario_generation_error(error_payload, room=sid)
            # Also emit via error handler if simulation context is available
            if data.simulationId or data.attemptId:
                await internal_sio.emit(
                    "scenario_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Database connection pool not available",
                        "attempt_id": data.attemptId,
                        "simulation_id": data.simulationId,
                        "operation": "scenario_generation",
                    },
                )
            return
    except Exception as e:
        error_payload = ScenarioGenerationErrorPayload(
            success=False, message=str(e), trace_id=trace_id
        )
        await scenario_generation_error(error_payload, room=sid)
        # Also emit via error handler if simulation context is available
        if data.simulationId or data.attemptId:
            await internal_sio.emit(
                "scenario_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": str(e),
                    "attempt_id": data.attemptId,
                    "simulation_id": data.simulationId,
                    "operation": "scenario_generation",
                },
            )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="scenarios.generated",
                template="{{ actor.name }} failed to generate scenario",
                context={"error": str(e)},
                endpoint="/socket/v4/scenarios/generate",
                error=True,
            )
        except Exception:
            pass


@sio.event  # type: ignore
async def generate_scenario(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateScenarioAIPayload(**data)
        await _generate_scenario_impl(sid, validated)
    except ValidationError as e:
        await scenario_generation_error(
            ScenarioGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def scenario_randomize(sid: str, data: dict[str, Any]) -> None:
    """Handle scenario randomization requests (without generation)."""
    try:
        validated = RandomizeScenarioPayload(**data)
        await _randomize_scenario_impl(sid, validated)
    except ValidationError as e:
        await scenario_randomize_error(
            ScenarioRandomizeErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="scenarios.randomized",
                template="{{ actor.name }} failed to randomize scenario selections (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v4/scenarios/randomize",
                error=True,
            )
        except Exception:
            pass


async def _randomize_scenario_impl(sid: str, data: RandomizeScenarioPayload) -> None:
    """Convert RandomizeScenarioPayload to GenerateScenarioAIPayload and call generation handler."""
    try:
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            # Get departmentId (required for GenerateScenarioAIPayload)
            # Use first from departmentIds, or get from scenario/profile
            department_id = None
            if data.departmentIds and len(data.departmentIds) > 0:
                department_id = data.departmentIds[0]
            elif data.scenarioId:
                sql = load_sql("app/sql/v4/scenario/get_scenario_departments.sql")
                dept_rows = await conn.fetch(sql, uuid.UUID(data.scenarioId))
                if dept_rows and len(dept_rows) > 0:
                    department_id = str(dept_rows[0]["department_id"])
            elif data.profileId:
                sql = load_sql("app/sql/v4/profile/get_departments_for_profile.sql")
                dept_rows = await conn.fetch(sql, data.profileId)
                if dept_rows and len(dept_rows) > 0:
                    department_id = str(dept_rows[0]["id"])

            if not department_id:
                await scenario_randomize_error(
                    ScenarioRandomizeErrorPayload(
                        success=False,
                        message="Could not determine departmentId",
                    ),
                    room=sid,
                )
                return

            # Convert RandomizeScenarioPayload to GenerateScenarioAIPayload
            # Set skipGeneration=True and pass randomizeType
            generate_payload = GenerateScenarioAIPayload(
                departmentId=department_id,
                scenarioAgentId="",  # Not needed for randomization only
                personaIds=data.personaIds,
                documentIds=data.documentIds,
                fieldIds=data.fieldIds,
                profileId=data.profileId,
                scenarioId=data.scenarioId,
                imagesEnabled=False,
                videoEnabled=False,
                objectivesEnabled=False,
                questionsEnabled=False,
                skipGeneration=True,  # Key: skip generation, only randomize
                randomizeType=data.randomize,  # Pass the randomize type
            )

            # Call the same implementation as generate_scenario
            await _generate_scenario_impl(sid, generate_payload)

    except Exception as e:
        await scenario_randomize_error(
            ScenarioRandomizeErrorPayload(success=False, message=str(e)),
            room=sid,
        )
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="scenarios.randomized",
                template="{{ actor.name }} failed to randomize scenario selections",
                context={"error": str(e)},
                endpoint="/socket/v4/scenarios/randomize",
                error=True,
            )
        except Exception:
            pass


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def generate_scenario_api(request: GenerateScenarioAIPayload) -> dict[str, bool]:
    """Client-to-server event: Generate a new scenario using AI."""
    return {"success": True}


@client_router.post("/randomize", response_model=dict[str, bool])
async def scenario_randomize_api(
    request: RandomizeScenarioPayload,
) -> dict[str, bool]:
    """Client-to-server event: Randomize scenario selections."""
    return {"success": True}


@server_router.post("/generation_progress", response_model=dict[str, bool])
async def scenario_generation_progress_api(
    request: ScenarioGenerationProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Scenario generation progress update."""
    return {"success": True}


@server_router.post("/generation_complete", response_model=dict[str, bool])
async def scenario_generation_complete_api(
    request: ScenarioGenerationCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Scenario generation completed successfully."""
    return {"success": True}


@server_router.post("/generation_error", response_model=dict[str, bool])
async def scenario_generation_error_api(
    request: ScenarioGenerationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred during scenario generation."""
    return {"success": True}
