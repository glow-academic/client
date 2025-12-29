"""Handler for generate_scenario WebSocket event."""

import json
import os
import uuid
from typing import Any

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    function_tool,
    gen_trace_id,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, Field, ValidationError, create_model
from utils.logging.db_logger import get_logger
from utils.settings.theme import ThemePrimitives, derive_theme_tokens
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.debug.debug_info import debug_info as debug_info_tool
from app.infra.v3.documents.format_document_info import format_document_info
from app.infra.v3.templates.jinja_renderer import render_template
from app.main import UPLOAD_FOLDER, get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

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
    objectivesMin: int | None = None
    objectivesMax: int | None = None
    imagesEnabled: bool = False  # Flag to enable image generation
    videoEnabled: bool = False  # Flag to enable video generation
    objectivesEnabled: bool = False  # Flag to enable objectives generation
    questionsEnabled: bool = False  # Flag to enable questions generation
    videoLength: int | None = None  # Optional: Video length in seconds (4, 8, or 12)


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
                logger.warning(
                    f"Array field '{field_name}' has no item definition, defaulting to list[str]"
                )
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
                logger.warning(
                    f"Object field '{field_name}' has no fields definition, creating empty model"
                )
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


async def _generate_scenario_impl(sid: str, data: GenerateScenarioAIPayload) -> None:
    """Handle scenario generation requests via WebSocket."""
    trace_id = gen_trace_id()

    try:
        logger.info(f"Received generate_scenario request from {sid} with data: {data}")

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
        profile_id = uuid.UUID(data.profileId) if data.profileId else None

        # Filter out empty lists
        if document_ids and len(document_ids) == 0:
            document_ids = None

        # Get connection pool
        pool = get_pool()
        if not pool:
            await scenario_generation_error(
                ScenarioGenerationErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    trace_id=trace_id,
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Clear previous results (now handled by storage with keys)

            # Emit start event
            await scenario_generation_progress(
                ScenarioGenerationProgressPayload(
                    type="start",
                    message="Starting scenario generation",
                    trace_id=trace_id,
                ),
                room=sid,
            )

            # Validate profile_id is required
            if not profile_id:
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message="profileId is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            # Pattern: All AI operations use atomic context+run creation SQL files
            # See WEBSOCKET_STANDARDS.md for details
            doc_ids_str = [str(d) for d in document_ids] if document_ids else []
            field_ids_str = [str(f) for f in field_ids] if field_ids else []

            sql = load_sql(
                "app/sql/v3/scenario/get_scenario_run_context_and_create_run.sql"
            )
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
                context_row = await conn.fetchrow(
                    sql,
                    str(department_id),
                    str(persona_id) if persona_id else None,
                    doc_ids_str,
                    field_ids_str,
                    str(scenario_agent_id),  # scenario_agent_id (required)
                    str(profile_id) if profile_id else None,  # profile_id (nullable)
                )
            except Exception as e:
                import asyncpg  # type: ignore

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
                # Log run creation failures for debugging
                logger.error(
                    f"Failed to get context and create run for {sid}: {str(e)}",
                    exc_info=True,
                )
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize scenario generation: {str(e)}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            if not context_row:
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False,
                        message=f"No scenario agent configured for department {data.departmentId}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Parse JSON arrays
            documents = (
                json.loads(context_row["documents"])
                if isinstance(context_row["documents"], str)
                else context_row["documents"]
            )
            parameter_items = (
                json.loads(context_row["parameter_items"])
                if isinstance(context_row["parameter_items"], str)
                else context_row["parameter_items"]
            )
            document_templates = (
                json.loads(context_row["document_templates"])
                if isinstance(context_row["document_templates"], str)
                else context_row["document_templates"]
            )

            agent_role = context_row.get("agent_role", "scenario")

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(context_row["run_id"])

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(context_row["agent_id"])
            sql_get_agent_tools = load_sql("app/sql/v3/agents/get_agent_tools.sql")
            rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
            agent_tools_config = [dict(row) for row in rows]
            # Create mapping of tool name -> tool config for quick lookup
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            context = {
                "agent_id": context_row["agent_id"],
                "agent_name": context_row["agent_name"],
                "agent_role": agent_role,
                "system_prompt": context_row["system_prompt"],
                "temperature": float(context_row["temperature"])
                if context_row["temperature"] is not None
                else 0.0,
                "reasoning": context_row["reasoning"],
                "model_id": context_row["model_id"],
                "model_name": context_row["model_name"],
                "custom_model": context_row["custom_model"],
                "provider_id": context_row["provider_id"],
                "provider_name": context_row["provider_name"],
                "base_url": context_row["base_url"],
                "api_key": context_row["api_key"],
                "persona": {
                    "id": context_row["persona_id"],
                    "name": context_row["persona_name"],
                    "description": context_row["persona_description"],
                }
                if context_row["persona_id"]
                else None,
                "documents": documents,
                "parameter_items": parameter_items,
                "document_templates": document_templates,
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
                # Theme tokens for Jinja2 rendering
                "theme_primitives": {
                    "primary": context_row.get("primary_color") or "#000000",
                    "accent": context_row.get("accent") or "#000000",
                    "background": context_row.get("background") or "#ffffff",
                    "surface": context_row.get("surface") or "#ffffff",
                    "success": context_row.get("success") or "#10b981",
                    "warning": context_row.get("warning") or "#f59e0b",
                    "error": context_row.get("error") or "#ef4444",
                    "sidebarBackground": context_row.get("sidebar_background")
                    or "#ffffff",
                    "sidebarPrimary": context_row.get("sidebar_primary") or "#000000",
                    "chart1": context_row.get("chart1") or "#8884d8",
                    "chart2": context_row.get("chart2") or "#82ca9d",
                    "chart3": context_row.get("chart3") or "#ffc658",
                    "chart4": context_row.get("chart4") or "#ff7300",
                    "chart5": context_row.get("chart5") or "#0088fe",
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
            group_id = None

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

            logger.info(
                f"Agent role: {agent_role}, objectives_enabled: {objectives_enabled}, "
                f"images_enabled: {images_enabled}, documents_enabled: {documents_enabled}, "
                f"video_enabled: {video_enabled}, questions_enabled: {questions_enabled}"
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

                logger.info(
                    f"[generate_scenario] Emitted problem statement to internal bus: "
                    f"statement_length={len(statement)}"
                )
                return "Created problem statement successfully"

            scenario_tools.append(function_tool(create_statement))
            logger.info("Created statement tool")

            # 2. Objectives Tool (if enabled)
            if objectives_enabled:
                # Build signature from database config if available
                objectives_config = tool_config_map.get("set_objectives")
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
                        logger.warning(
                            f"Objectives count ({len(objectives)}) outside recommended range of 1-{max_objectives}"
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

                    logger.info(
                        f"[generate_scenario] Emitted objectives to internal bus: "
                        f"{len(objectives)} objectives"
                    )
                    return f"Set {len(objectives)} learning objectives successfully"

                scenario_tools.append(function_tool(set_objectives))
                logger.info("Created objectives tool")
            else:
                logger.info("Objectives tool skipped (objectives_enabled=False)")

            # 3. Dynamic Document Tool (if enabled)
            if documents_enabled:
                if not final_profile_id:
                    logger.warning(
                        "profile_id required for dynamic document storage, skipping tool"
                    )
                else:
                    # Extract template schema from document_templates if available
                    template_schema: dict[str, Any] | None = None
                    if document_templates and len(document_templates) > 0:
                        # Use the first template's schema (typically there's only one)
                        first_template = document_templates[0]
                        template_args_raw = first_template.get("template_args")
                        if template_args_raw:
                            # Parse if it's a string, otherwise use as-is
                            if isinstance(template_args_raw, str):
                                try:
                                    template_schema = json.loads(template_args_raw)
                                except json.JSONDecodeError:
                                    logger.warning(
                                        "Failed to parse template_args JSON, falling back to untyped function"
                                    )
                            elif isinstance(template_args_raw, dict):
                                template_schema = template_args_raw
                            else:
                                logger.warning(
                                    f"Unexpected template_args type: {type(template_args_raw)}, falling back to untyped function"
                                )

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
                            logger.error(
                                f"Template rendering failed: {error_msg}", exc_info=True
                            )
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

                        logger.info(
                            f"[generate_scenario] Emitted document to internal bus: "
                            f"parent={parent_document_id}, file_path={file_path}, "
                            f"size={file_size} bytes"
                        )
                        return "Dynamic document created successfully. Template rendered and saved."

                    # If we have a template schema, create a function with individual parameters
                    if template_schema:
                        TemplateArgsModel: type[BaseModel] | None = None
                        try:
                            TemplateArgsModel = _build_template_model(template_schema)
                            logger.info(
                                f"Built strongly typed template model: {TemplateArgsModel.__name__}"
                            )
                        except Exception as e:
                            logger.warning(
                                f"Failed to build template model, falling back to dict: {e}",
                                exc_info=True,
                            )
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

                                logger.info(
                                    f"Created dynamic document function with {len(param_names)} individual parameters"
                                )
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
            else:
                logger.info("Dynamic document tool skipped (documents_enabled=False)")

            # 4. Video Generation Tool (if enabled)
            if video_enabled:
                if not hasattr(data, "videoAgentId") or not data.videoAgentId:
                    logger.warning(
                        "videoAgentId required for video generation, skipping tool"
                    )
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
                            logger.warning(
                                "[generate_scenario] scenarioId missing; skipping video generation tool"
                            )
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

                        logger.info(
                            f"[generate_scenario] Emitted video generation to internal bus: "
                            f"prompt_length={len(prompt)}, image_ids={image_ids}"
                        )
                        return "Video generation started successfully"

                    scenario_tools.append(function_tool(create_video))
                    logger.info("Created video creation tool")
            else:
                logger.info("Video generation tool skipped (video_enabled=False)")

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
                    logger.info(
                        f"[generate_scenario] Created question {current_count}: {question_text[:50]}..."
                    )

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
                logger.info("Created question tool")
            else:
                logger.info(
                    "Questions generation tool skipped (questions_enabled=False)"
                )

            # 6. Image Generation Tool (if enabled)
            if images_enabled:
                if not final_profile_id:
                    logger.warning(
                        "profile_id required for image generation, skipping tool"
                    )
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

                        logger.info(
                            f"[generate_scenario] Emitted image to internal bus: "
                            f"name={name}, prompt_length={len(prompt)}"
                        )
                        return f"Image generation initiated for '{name}'. Image will be created and linked when ready."

                    scenario_tools.append(function_tool(create_image))
                    logger.info("Created image creation tool")
            else:
                logger.info("Image generation tool skipped (images_enabled=False)")

            # Add debug info tool
            scenario_tools.append(debug_info_tool)

            logger.info(f"Total scenario tools created: {len(scenario_tools)}")

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
                logger.info(
                    f"tool_use_behavior called with {len(tool_results)} tool results"
                )

                for idx, result in enumerate(tool_results):
                    logger.info(f"Tool result {idx}: type={type(result)}")
                    logger.info(
                        f"Tool result {idx} dir: {[x for x in dir(result) if not x.startswith('_')]}"
                    )

                    # Try multiple ways to get tool name (FunctionToolResult structure may vary)
                    tool_name = None

                    # Try direct attribute access (like hint agent)
                    if hasattr(result, "tool_name"):
                        tool_name = result.tool_name  # type: ignore[attr-defined]
                        logger.info(
                            f"Tool result {idx}: Found tool_name via hasattr: {tool_name}"
                        )
                    # Try getattr as fallback
                    else:
                        tool_name = getattr(result, "tool_name", None)  # type: ignore[misc]
                        if tool_name:
                            logger.info(
                                f"Tool result {idx}: Found tool_name via getattr: {tool_name}"
                            )
                        else:
                            tool_name = getattr(result, "name", None)  # type: ignore[misc]
                            if tool_name:
                                logger.info(
                                    f"Tool result {idx}: Found name via getattr: {tool_name}"
                                )

                    # Try to get tool name from tool object if result has one
                    if not tool_name:
                        tool_obj = getattr(result, "tool", None)  # type: ignore[misc]
                        if tool_obj:
                            tool_name = getattr(tool_obj, "name", None)  # type: ignore[misc]
                            if tool_name:
                                logger.info(
                                    f"Tool result {idx}: Found tool.name: {tool_name}"
                                )

                    if tool_name and isinstance(tool_name, str):
                        logger.info(
                            f"Tool result {idx}: Processing tool_name={tool_name}"
                        )
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
                        logger.info(
                            f"Tool result {idx}: Normalized to {normalized_name}"
                        )
                    else:
                        logger.warning(
                            f"Tool result {idx}: Could not extract tool name. tool_name={tool_name}, type={type(tool_name)}"
                        )
                        # Log the actual result object for debugging
                        logger.info(f"Tool result {idx} repr: {repr(result)}")

                # Check if all required tools have been completed
                all_completed = all(tool in completed_tools for tool in required_tools)

                logger.info(
                    f"Tool use behavior check: required={required_tools}, "
                    f"completed={completed_tools}, all_completed={all_completed}, "
                    f"tool_results_count={len(tool_results)}"
                )

                # If no tools detected but we have results, log what we got
                if len(tool_results) > 0 and len(completed_tools) == 0:
                    logger.warning(
                        f"Tool results present ({len(tool_results)}) but no tool names extracted. "
                        f"First result type: {type(tool_results[0])}, "
                        f"First result dir: {[x for x in dir(tool_results[0]) if not x.startswith('_')][:10]}"
                    )

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

            # Run agent (message logging and token updates happen async via pricing endpoint)
            with trace(
                "Scenario Agent",
                group_id=str(group_id) if group_id else None,
                trace_id=trace_id,
            ):
                result = await Runner.run(
                    agent_instance,
                    input=clean_input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            usage = result.context_wrapper.usage
            assistant_output = getattr(result, "final_output", None) or ""

            # Emit async pricing event via internal bus (non-blocking)
            # This handles token updates and message logging in background
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "scenario",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": clean_input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
            )

            # Emit completion event
            # Note: Individual tool completion events are emitted separately by tool handlers
            # Client should listen to scenario_tool_*_complete events for actual data
            await scenario_generation_complete(
                ScenarioGenerationCompletePayload(
                    success=True,
                    message="Scenario generation completed. Check tool completion events for created resources.",
                    trace_id=trace_id,
                ),
                room=sid,
            )
            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="scenarios.generated",
                    template="{{ actor.name }} generated scenario",
                    context={"trace_id": trace_id},
                    endpoint="/socket/v3/scenarios/generate",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging scenario generation activity: {log_error}"
                )

    except Exception as e:
        logger.error(f"Error in generate_scenario for {sid}: {str(e)}", exc_info=True)
        await scenario_generation_error(
            ScenarioGenerationErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="scenarios.generated",
                template="{{ actor.name }} failed to generate scenario",
                context={"error": str(e)},
                endpoint="/socket/v3/scenarios/generate",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging scenario generation error activity: {log_error}"
            )


@sio.event  # type: ignore
async def generate_scenario(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateScenarioAIPayload(**data)
        await _generate_scenario_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in generate_scenario for {sid}: {e}")
        await scenario_generation_error(
            ScenarioGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def generate_scenario_api(request: GenerateScenarioAIPayload) -> dict[str, bool]:
    """Client-to-server event: Generate a new scenario using AI."""
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
