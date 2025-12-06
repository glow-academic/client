"""Handler for generate_scenario_ai WebSocket event."""

import json
import uuid
from typing import Any

from agents import (FunctionToolResult, RunContextWrapper, Runner,
                    ToolsToFinalOutputResult, gen_trace_id, trace)
from agents.items import TResponseInputItem
from app.main import get_pool, scenario_progress, scenario_results, sio
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_scenario_tools import create_scenario_tools
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document.format_document_info import format_document_info
from app.utils.documents.create_dynamic_document import create_dynamic_document
from app.utils.agents.tools.create_dynamic_document_function import (
    dynamic_document_results,
    available_templates,
)
from app.utils.logging.db_logger import get_logger
from app.utils.personas import format_persona_info
from app.utils.scenario import format_parameter_item_info
from app.utils.scenario.format_document_template_info import format_document_template_info
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class ScenarioGenerationProgressPayload(BaseModel):
    type: str  # "start", "tool_call", "complete"
    message: str | None = None
    tool_name: str | None = None
    trace_id: str | None = None


class ScenarioGenerationCompletePayload(BaseModel):
    success: bool
    message: str
    title: str
    description: str
    objectives: list[str]
    dynamic_document_mapping: dict[str, str] | None = None
    trace_id: str | None = None


class ScenarioGenerationErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str | None = None


# Pydantic model for client-to-server event
class GenerateScenarioAIPayload(BaseModel):
    departmentId: str
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None
    profileId: str | None = None
    userInstructions: str | None = None
    objectivesEnabled: bool = True


# Emit helper functions
async def scenario_generation_progress(
    payload: ScenarioGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "scenario_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def scenario_generation_complete(
    payload: ScenarioGenerationCompletePayload, room: str
) -> None:
    await sio.emit("scenario_generation_complete", payload.model_dump(), room=room)


async def scenario_generation_error(
    payload: ScenarioGenerationErrorPayload, room: str
) -> None:
    await sio.emit("scenario_generation_error", payload.model_dump(), room=room)


async def _generate_scenario_ai_impl(
    sid: str, data: GenerateScenarioAIPayload
) -> None:
    """Handle scenario AI generation requests via WebSocket."""
    trace_id = gen_trace_id()
    
    try:
        logger.info(
            f"Received generate_scenario_ai request from {sid} with data: {data}"
        )

        # Convert string IDs to UUIDs
        department_id = uuid.UUID(data.departmentId)
        persona_ids = (
            [uuid.UUID(p) for p in data.personaIds] if data.personaIds else None
        )
        persona_id = persona_ids[0] if persona_ids and len(persona_ids) > 0 else None
        document_ids = (
            [uuid.UUID(d) for d in data.documentIds] if data.documentIds else None
        )
        parameter_item_ids = (
            [uuid.UUID(p) for p in data.parameterItemIds]
            if data.parameterItemIds
            else None
        )
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
            # Clear previous results
            scenario_results.clear()
            scenario_progress.clear()
            dynamic_document_results.clear()
            available_templates.clear()

            # Emit start event
            await scenario_generation_progress(
                ScenarioGenerationProgressPayload(
                    type="start",
                    message="Starting scenario generation",
                    trace_id=trace_id,
                ),
                room=sid,
            )

            # Get all context data in a single optimized query using SQL file
            doc_ids_str = [str(d) for d in document_ids] if document_ids else []
            param_ids_str = (
                [str(p) for p in parameter_item_ids] if parameter_item_ids else []
            )

            sql = load_sql("sql/v3/agents/get_scenario_run_context.sql")
            context_row = await conn.fetchrow(
                sql,
                str(department_id),
                str(persona_id) if persona_id else None,
                doc_ids_str,
                param_ids_str,
            )

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
                "document_templates": document_templates,
                "default_guest_profile_id": context_row["guest_profile_id"],
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
            }

            # Format persona info if persona was provided
            if persona_id is None or context["persona"] is None:
                persona_info = None
                show_images = False
            else:
                persona_info = format_persona_info(context["persona"])
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
                parameter_item_info = format_parameter_item_info(
                    context["parameter_items"]
                )

            # Format document template info if templates are available
            document_template_info = format_document_template_info(
                context["document_templates"]
            )

            # Create scenario generation tools
            group_id = None
            objectives_enabled = data.objectivesEnabled
            documents_enabled = bool(document_ids and len(document_ids) > 0)
            scenario_tools = create_scenario_tools(
                group_id,
                objectives_enabled=objectives_enabled,
                documents_enabled=documents_enabled,
            )
            scenario_tools.append(debug_info_tool)

            # Create tool use behavior to check when all required tools are called
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                required_tools = ["title_description"]
                if objectives_enabled:
                    required_tools.append("objectives")

                completed_required = all(
                    scenario_progress.get(tool, False) for tool in required_tools
                )

                return ToolsToFinalOutputResult(is_final_output=completed_required)

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
                parameter_item_info,
                document_template_info,
            ]

            # Add user instructions as first input item if provided
            if data.userInstructions and data.userInstructions.strip():
                user_instructions_item: TResponseInputItem = {
                    "role": "user",
                    "content": f"User instructions for scenario generation: {data.userInstructions.strip()}",
                }
                input_items.insert(0, user_instructions_item)

            clean_input_items = [item for item in input_items if item is not None]

            # Use default guest profile from context if no profile_id provided
            final_profile_id = (
                profile_id if profile_id else context["default_guest_profile_id"]
            )

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

            req_per_day = context["req_per_day"]
            runs_today_count = context["runs_today_count"]

            if req_per_day is not None and runs_today_count >= req_per_day:
                from datetime import timedelta
                from zoneinfo import ZoneInfo

                earliest_run_created_at = context["earliest_run_created_at"]
                if earliest_run_created_at:
                    next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                    eastern_tz = ZoneInfo("America/New_York")
                    next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                    error_message = (
                        f"Daily request limit of {req_per_day} reached. "
                        f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                        f"{next_allowed_et.strftime('%B %d, %Y')}."
                    )
                else:
                    error_message = (
                        f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                    )
                await scenario_generation_error(
                    ScenarioGenerationErrorPayload(
                        success=False, message=error_message, trace_id=trace_id
                    ),
                    room=sid,
                )
                return

            # Create model run with all junction records using SQL file
            sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                str(department_id),
                context["model_id"],
                context["agent_id"],
                "agent",
                final_profile_id,
                None,  # key_id
                str(context["agent_id"]),  # agent_id
            )
            model_run_id = uuid.UUID(model_run_row["run_id"])

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

            # Extract results from the global storage
            scenario_result = scenario_results

            usage = result.context_wrapper.usage

            # Update model run with token usage using SQL file
            sql_update_tokens = load_sql(
                "sql/v3/model_runs/update_model_run_tokens.sql"
            )
            await conn.execute(
                sql_update_tokens,
                str(model_run_id),
                usage.input_tokens,
                usage.output_tokens,
            )

            # Get result values
            title = scenario_result.get("title", "")
            description = scenario_result.get("description", "")
            objectives = (
                scenario_result.get("objectives", []) if objectives_enabled else []
            )

            # Limit objectives to maximum 3
            limited_objectives = objectives[:3] if objectives else []

            # Process dynamic documents if any were created
            dynamic_document_mapping: dict[str, str] | None = None
            if dynamic_document_results.get("dynamic_documents"):
                dynamic_document_mapping = {}
                for doc_request in dynamic_document_results["dynamic_documents"]:
                    try:
                        parent_id = uuid.UUID(doc_request["parent_document_id"])
                        template_args = doc_request["template_args"]

                        # Create child document
                        # http_request is optional and only used for theme settings
                        child_id = await create_dynamic_document(
                            conn=conn,
                            parent_document_id=parent_id,
                            template_args=template_args,
                            department_id=department_id,
                            profile_id=profile_id,
                            http_request=None,  # WebSocket doesn't have HTTP request
                        )

                        dynamic_document_mapping[str(parent_id)] = str(child_id)
                        logger.info(
                            f"Created dynamic child document {child_id} from parent {parent_id}"
                        )
                    except Exception as e:
                        logger.error(
                            f"Failed to create dynamic document from parent {doc_request.get('parent_document_id')}: {e}",
                            exc_info=True,
                        )
                        # Continue with other documents even if one fails

                # Clear dynamic document results after processing
                dynamic_document_results.clear()

            # Emit completion event
            await scenario_generation_complete(
                ScenarioGenerationCompletePayload(
                    success=True,
                    message="Scenario generated successfully",
                    title=title,
                    description=description,
                    objectives=limited_objectives,
                    dynamic_document_mapping=dynamic_document_mapping,
                    trace_id=trace_id,
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in generate_scenario_ai for {sid}: {str(e)}", exc_info=True
        )
        await scenario_generation_error(
            ScenarioGenerationErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def generate_scenario_ai(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateScenarioAIPayload(**data)
        await _generate_scenario_ai_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in generate_scenario_ai for {sid}: {e}")
        await scenario_generation_error(
            ScenarioGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )

