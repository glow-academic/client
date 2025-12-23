"""Handler for regenerate_scenario WebSocket event."""

import json
import uuid
from typing import Any

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    ToolsToFinalOutputResult,
    gen_trace_id,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, get_scenario_storage, sio
from app.utils.activity.websocket_logger import log_websocket_activity
from app.utils.agents.generic_agent import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.logging.db_logger import get_logger
from app.utils.messages.log_regeneration_messages import log_regeneration_messages
from app.utils.scenario.image_generation import (
    get_image_generation_results,
    set_image_generation_context,
)
from app.utils.sql_helper import load_sql
from app.utils.storage.request_storage import build_storage_key
from app.utils.tools.load_agent_tools import load_agent_tools
from app.utils.tools.build_pydantic_fields import build_function_signature_string
from agents import Tool, function_tool
from pydantic import Field

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class ScenarioRegenerationProgressPayload(BaseModel):
    """Response indicating progress in scenario regeneration."""

    type: str  # "start", "complete"
    message: str | None = None
    trace_id: str | None = None


class ScenarioRegenerationCompletePayload(BaseModel):
    """Response indicating scenario regeneration completed successfully."""

    success: bool
    message: str
    title: str
    description: str
    objectives: list[str]
    dynamic_document_mapping: dict[str, Any] | None = (
        None  # Dynamic mapping of document uploads
    )
    generated_image_ids: list[str] | None = None
    trace_id: str | None = None


class ScenarioRegenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in scenario regeneration."""

    success: bool
    message: str
    trace_id: str | None = None


# Pydantic model for client-to-server event
class RegenerateScenarioPayload(BaseModel):
    """Request to regenerate a scenario."""

    scenarioId: str
    userInstructions: str
    departmentId: str
    profileId: str | None = None
    objectivesEnabled: bool = True


# Emit helper functions
async def scenario_regeneration_progress(
    payload: ScenarioRegenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "scenario_regeneration_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def scenario_regeneration_complete(
    payload: ScenarioRegenerationCompletePayload, room: str
) -> None:
    await sio.emit("scenarios_regeneration_complete", payload.model_dump(), room=room)


async def scenario_regeneration_error(
    payload: ScenarioRegenerationErrorPayload, room: str
) -> None:
    await sio.emit("scenarios_regeneration_error", payload.model_dump(), room=room)


async def _regenerate_scenario_impl(sid: str, data: RegenerateScenarioPayload) -> None:
    """Handle scenario regeneration requests via WebSocket."""
    trace_id = gen_trace_id()

    try:
        logger.info(
            f"Received regenerate_scenario request from {sid} with scenarioId: {data.scenarioId}"
        )

        # Convert string IDs to UUIDs
        scenario_id = uuid.UUID(data.scenarioId)
        department_id = uuid.UUID(data.departmentId)
        profile_id = uuid.UUID(data.profileId) if data.profileId else None
        objectives_enabled = data.objectivesEnabled

        # Get connection pool
        pool = get_pool()
        if not pool:
            await scenario_regeneration_error(
                ScenarioRegenerationErrorPayload(
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
            await scenario_regeneration_progress(
                ScenarioRegenerationProgressPayload(
                    type="start",
                    message="Starting scenario regeneration",
                    trace_id=trace_id,
                ),
                room=sid,
            )

            # Get previous run for this scenario
            sql_get_previous_run = load_sql(
                "sql/v3/messages/get_previous_run_for_entity.sql"
            )
            previous_run_row = await conn.fetchrow(
                sql_get_previous_run,
                str(scenario_id),
                "scenario",
            )

            if not previous_run_row or not previous_run_row.get("run_id"):
                await scenario_regeneration_error(
                    ScenarioRegenerationErrorPayload(
                        success=False,
                        message=f"No previous run found for scenario {data.scenarioId}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            previous_run_id = uuid.UUID(previous_run_row["run_id"])

            # Get scenario's current persona/document/parameter IDs and agent_id
            sql_get_scenario_ids = load_sql("sql/v3/scenarios/get_scenario_ids_for_regeneration.sql")
            scenario_ids_row = await conn.fetchrow(sql_get_scenario_ids, str(scenario_id))

            if not scenario_ids_row:
                await scenario_regeneration_error(
                    ScenarioRegenerationErrorPayload(
                        success=False,
                        message=f"Scenario {data.scenarioId} not found",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            persona_id = (
                uuid.UUID(scenario_ids_row["persona_id"])
                if scenario_ids_row["persona_id"]
                else None
            )
            document_ids = (
                [uuid.UUID(d) for d in scenario_ids_row["document_ids"]]
                if scenario_ids_row["document_ids"]
                else []
            )
            parameter_item_ids = (
                [uuid.UUID(p) for p in scenario_ids_row["parameter_item_ids"]]
                if scenario_ids_row["parameter_item_ids"]
                else []
            )
            scenario_agent_id = (
                uuid.UUID(scenario_ids_row["scenario_agent_id"])
                if scenario_ids_row["scenario_agent_id"]
                else None
            )

            if not scenario_agent_id:
                await scenario_regeneration_error(
                    ScenarioRegenerationErrorPayload(
                        success=False,
                        message=f"Scenario {data.scenarioId} has no scenario agent configured",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Get context AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            doc_ids_str = [str(d) for d in document_ids] if document_ids else []
            param_ids_str = (
                [str(p) for p in parameter_item_ids] if parameter_item_ids else []
            )

            sql = load_sql(
                "sql/v3/agents/get_scenario_regeneration_run_context_and_create_run.sql"
            )
            try:
                context_row = await conn.fetchrow(
                    sql,
                    str(department_id),
                    str(persona_id) if persona_id else None,
                    doc_ids_str,
                    param_ids_str,
                    str(scenario_agent_id),  # agent_id (required)
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
                    await scenario_regeneration_error(
                        ScenarioRegenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return
                # Log other errors
                logger.error(
                    f"Failed to get context and create run for {sid}: {str(e)}",
                    exc_info=True,
                )
                await scenario_regeneration_error(
                    ScenarioRegenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize scenario regeneration: {str(e)}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            if not context_row:
                await scenario_regeneration_error(
                    ScenarioRegenerationErrorPayload(
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
                else context_row["documents"] or []
            )
            personas = (
                json.loads(context_row["personas"])
                if isinstance(context_row["personas"], str)
                else context_row["personas"] or []
            )
            parameter_items = (
                json.loads(context_row["parameter_items"])
                if isinstance(context_row["parameter_items"], str)
                else context_row["parameter_items"] or []
            )

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(context_row["agent_id"])
            agent_tools_config = await load_agent_tools(conn, agent_id_uuid)
            # Create mapping of tool name -> tool config for quick lookup
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Build context dict (same structure as generate_ai)
            context = {
                "agent_id": context_row["agent_id"],
                "agent_name": context_row["agent_name"],
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
                "document_templates": (
                    json.loads(context_row["document_templates"])
                    if isinstance(context_row["document_templates"], str)
                    else context_row["document_templates"] or []
                ),
                "default_guest_profile_id": context_row["guest_profile_id"],
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
            }

            # Format input items (same as generation)
            from app.utils.document.format_document_info import format_document_info

            # Format persona info if persona was provided
            if persona_id is None or context["persona"] is None:
                persona_info = None
                show_images = False
            else:
                persona_dict = context["persona"]
                if isinstance(persona_dict, dict):
                    persona_info = {
                        "role": "user",
                        "content": f"This is the profile of the student: Name: {persona_dict['name']} Description: {persona_dict.get('description', '')}",
                    }
                else:
                    persona_info = None
                show_images = False

            # Format document info if documents were provided
            if not document_ids or len(document_ids) == 0:
                document_info = None
            else:
                document_info = format_document_info(context["documents"], show_images)

            # Format parameter item info if parameter items were provided
            if not parameter_item_ids or len(parameter_item_ids) == 0:
                parameter_item_info = None
            else:
                parameter_items = context["parameter_items"]
                if not parameter_items:
                    parameter_item_info = {
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
                    parameter_item_info = {
                        "role": "user",
                        "content": content,
                    }

            input_items: list[TResponseInputItem | None] = [
                persona_info,
                document_info,
                parameter_item_info,
            ]

            # Create scenario tools
            group_id = None
            documents_enabled = bool(document_ids and len(document_ids) > 0)
            images_enabled = True  # Enable image generation by default

            # Use default guest profile from context if no profile_id provided
            final_profile_id = (
                profile_id if profile_id else context.get("default_guest_profile_id")
            )

            # For regeneration, use scenario_id as primary_id (same scenario = same key)
            primary_id = str(scenario_id)

            clean_input_items = [item for item in input_items if item is not None]

            # Set image generation context before creating tools (async)
            if images_enabled and final_profile_id:
                await set_image_generation_context(
                    agent_id=context["agent_id"],
                    profile_id=str(final_profile_id),
                    primary_id=primary_id,
                    department_id=str(department_id) if department_id else None,
                    room=sid,  # WebSocket room for emitting events
                )

            # Create scenario generation tools inline (same as generate handler)
            scenario_tools: list[Tool] = []
            
            # 1. Title and Description Tool (always included)
            title_desc_config = tool_config_map.get("set_title_and_description")
            if title_desc_config:
                title_desc = title_desc_config.get("argument_descriptions", {}).get("title", "Short, descriptive title for the scenario (5-10 words)")
                scenario_desc = title_desc_config.get("argument_descriptions", {}).get("scenario", "Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it")
            else:
                title_desc = "Short, descriptive title for the scenario (5-10 words)"
                scenario_desc = "Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it"
            
            async def set_title_description(
                title: str = Field(description=title_desc),
                scenario: str = Field(description=scenario_desc),
            ) -> str:
                """Set the title and description for the scenario."""
                await internal_sio.emit(
                    "scenario_tool_problem_statement",
                    {
                        "sid": sid,
                        "trace_id": trace_id,
                        "title": title,
                        "description": scenario,
                        "scenario_id": str(scenario_id),
                    },
                )
                logger.info(f"[regenerate_scenario] Emitted problem statement: title={title}")
                return "Set title and description successfully"
            
            scenario_tools.append(function_tool(set_title_description))
            
            # 2. Objectives Tool (if enabled)
            if objectives_enabled:
                objectives_config = tool_config_map.get("set_objectives")
                if objectives_config:
                    objectives_desc = objectives_config.get("argument_descriptions", {}).get("objectives", "List of 1-3 specific learning objectives that GTAs should achieve in this scenario")
                else:
                    objectives_desc = "List of 1-3 specific learning objectives that GTAs should achieve in this scenario"
                
                async def set_objectives(
                    objectives: list[str] = Field(description=objectives_desc),
                ) -> str:
                    """Set the learning objectives for this scenario."""
                    objectives = objectives[:3]  # Limit to 3
                    await internal_sio.emit(
                        "scenario_tool_objectives",
                        {
                            "sid": sid,
                            "trace_id": trace_id,
                            "objectives": objectives,
                            "scenario_id": str(scenario_id),
                        },
                    )
                    logger.info(f"[regenerate_scenario] Emitted objectives: {len(objectives)} objectives")
                    return f"Set {len(objectives)} learning objectives successfully"
                
                scenario_tools.append(function_tool(set_objectives))
            
            # 3. Dynamic Document Tool (if enabled) - simplified version for regeneration
            if documents_enabled and context["document_templates"]:
                # For regeneration, use a simpler fallback approach
                async def create_document_fallback(
                    template_args: dict[str, Any],
                ) -> str:
                    """Create a dynamic child document from the available template document."""
                    await internal_sio.emit(
                        "scenario_tool_document",
                        {
                            "sid": sid,
                            "trace_id": trace_id,
                            "template_args": template_args,
                            "scenario_id": str(scenario_id),
                        },
                    )
                    logger.info("[regenerate_scenario] Emitted document creation")
                    return "Dynamic document creation queued"
                
                scenario_tools.append(function_tool(create_document_fallback))  # type: ignore[arg-type]
            
            # 4. Image Generation Tool (if enabled)
            if images_enabled:
                image_config = tool_config_map.get("generate_image")
                if image_config:
                    name_desc = image_config.get("argument_descriptions", {}).get("name", "Descriptive name for the generated image")
                    prompt_desc = image_config.get("argument_descriptions", {}).get("prompt", "Detailed, descriptive prompt for image generation")
                else:
                    name_desc = "Descriptive name for the generated image"
                    prompt_desc = "Detailed, descriptive prompt for image generation"
                
                async def generate_image(
                    name: str = Field(description=name_desc),
                    prompt: str = Field(description=prompt_desc),
                ) -> str:
                    """Generate an image from a detailed prompt."""
                    await internal_sio.emit(
                        "scenario_tool_image",
                        {
                            "sid": sid,
                            "trace_id": trace_id,
                            "name": name,
                            "prompt": prompt,
                            "agent_id": context["agent_id"],
                            "department_id": str(department_id) if department_id else None,
                            "profile_id": str(final_profile_id) if final_profile_id else None,
                            "scenario_id": str(scenario_id),
                        },
                    )
                    logger.info(f"[regenerate_scenario] Emitted image: name={name}")
                    return f"Image generation initiated for '{name}'"
                
                scenario_tools.append(function_tool(generate_image))
            
            scenario_tools.append(debug_info_tool)

            # Check if template documents are available (require create_document if so)
            has_template_documents = bool(
                context["document_templates"] and len(context["document_templates"]) > 0
            )

            # Create tool use behavior
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                required_tools = ["title_description"]
                if objectives_enabled:
                    required_tools.append("objectives")
                if has_template_documents:
                    required_tools.append("create_document")

                # Check which tools have been called
                completed_tools = []
                for result in tool_results:
                    # FunctionToolResult has tool_name attribute (see hint agent example)
                    tool_name = getattr(result, "tool_name", None)  # type: ignore[misc]
                    if tool_name and isinstance(tool_name, str):
                        # Normalize tool names (handle variations like set_title_and_description -> title_description)
                        normalized_name = tool_name
                        if (
                            "title" in tool_name.lower()
                            and "description" in tool_name.lower()
                        ):
                            normalized_name = "title_description"
                        elif "objective" in tool_name.lower():
                            normalized_name = "objectives"
                        elif "create_document" in tool_name.lower() or (
                            "create" in tool_name.lower()
                            and "document" in tool_name.lower()
                        ):
                            normalized_name = "create_document"
                        completed_tools.append(normalized_name)

                # Check if all required tools have been completed
                all_completed = all(tool in completed_tools for tool in required_tools)

                logger.info(
                    f"Tool use behavior check: required={required_tools}, "
                    f"completed={completed_tools}, all_completed={all_completed}"
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

            # Use default guest profile from context if no profile_id provided
            final_profile_id = (
                profile_id
                if profile_id
                else uuid.UUID(context["default_guest_profile_id"])
            )
            if not final_profile_id:
                await scenario_regeneration_error(
                    ScenarioRegenerationErrorPayload(
                        success=False,
                        message="Profile not found. Please contact support.",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Rate limit validation and run creation are now handled in SQL
            # (get_scenario_regeneration_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(context_row["run_id"])

            # Run the agent
            with trace(
                "Scenario Regeneration",
                group_id=str(group_id) if group_id else None,
                trace_id=trace_id,
            ):
                result = await Runner.run(
                    agent_instance,
                    input=clean_input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Log regeneration messages (reuse existing system/developer, add user + assistant)
            assistant_output = getattr(result, "final_output", None) or ""
            await log_regeneration_messages(
                conn=conn,
                run_id=model_run_id,
                previous_run_id=previous_run_id,
                user_instructions=data.userInstructions,
                assistant_output=assistant_output,
                department_id=department_id,
            )

            # Extract results from request-scoped storage
            storage = get_scenario_storage()
            storage_key = build_storage_key(
                operation_type="scenario_regeneration",
                profile_id=str(final_profile_id),
                primary_id=primary_id,
            )
            scenario_result = await storage.get_all(storage_key)

            usage = result.context_wrapper.usage
            assistant_output = getattr(result, "final_output", None) or ""

            # Emit async pricing event via internal bus (non-blocking)
            # This handles token updates and message logging in background
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "scenario_regeneration",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": clean_input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
            )

            # Get result values
            title = scenario_result.get("title", "")
            description = scenario_result.get("description", "")
            objectives = (
                scenario_result.get("objectives", []) if objectives_enabled else []
            )

            # Limit objectives to maximum 3
            limited_objectives = objectives[:3] if objectives else []

            # Retrieve image_ids from storage (images are generated in background)
            generated_image_ids: list[str] = []
            if final_profile_id:
                image_results = await get_image_generation_results(
                    profile_id=str(final_profile_id),
                    primary_id=primary_id,
                )
                # image_results["images"] contains list of image_ids (strings)
                image_ids = image_results.get("images", [])
                if image_ids:
                    generated_image_ids = image_ids
                    logger.info(
                        f"Retrieved {len(generated_image_ids)} image IDs from storage "
                        f"(generation in progress in background)"
                    )
                    # Don't clear storage - background tasks will clean up individual image contexts

            # Emit completion event
            await scenario_regeneration_complete(
                ScenarioRegenerationCompletePayload(
                    success=True,
                    message="Scenario regenerated successfully",
                    title=title,
                    description=description,
                    objectives=limited_objectives,
                    dynamic_document_mapping=None,  # Regeneration doesn't create dynamic documents
                    trace_id=trace_id,
                ),
                room=sid,
            )
            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="scenarios.regenerated",
                    template="{{ actor.name }} regenerated scenario",
                    context={"trace_id": trace_id},
                    endpoint="/socket/v3/scenarios/regenerate",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(
                    f"Error logging scenario regeneration activity: {log_error}"
                )

    except Exception as e:
        logger.error(f"Error in regenerate_scenario for {sid}: {str(e)}", exc_info=True)
        await scenario_regeneration_error(
            ScenarioRegenerationErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="scenarios.regenerated",
                template="{{ actor.name }} failed to regenerate scenario",
                context={"error": str(e)},
                endpoint="/socket/v3/scenarios/regenerate",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging scenario regeneration error activity: {log_error}"
            )


@sio.event  # type: ignore
async def regenerate_scenario(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = RegenerateScenarioPayload(**data)
        await _regenerate_scenario_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in regenerate_scenario for {sid}: {e}")
        await scenario_regeneration_error(
            ScenarioRegenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/regenerate", response_model=dict[str, bool])
async def regenerate_scenario_api(
    request: RegenerateScenarioPayload,
) -> dict[str, bool]:
    """Client-to-server event: Regenerate a scenario with new attributes."""
    return {"success": True}
