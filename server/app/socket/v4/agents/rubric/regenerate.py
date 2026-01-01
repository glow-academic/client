"""Handler for rubric_regenerate WebSocket event."""

import uuid
from typing import Any, cast

from agents import Runner, function_tool, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import Field
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetRubricRegenerationRunContextAndCreateRunApiRequest,
    GetRubricRegenerationRunContextAndCreateRunSqlParams,
    GetRubricRegenerationRunContextAndCreateRunSqlRow,
    IUpdateStandardDescriptionsV4Description,
    RubricGenerationCompleteApiRequest,
    RubricGenerationErrorApiRequest,
    RubricGenerationErrorSqlRow,
    RubricGenerationProgressApiRequest,
    UpdateStandardDescriptionsApiRequest,
)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v4/rubric/get_rubric_regeneration_run_context_and_create_run_complete.sql"
)

internal_sio = get_internal_sio()


async def _rubric_regenerate_impl(
    sid: str,
    data: GetRubricRegenerationRunContextAndCreateRunApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle rubric regeneration requests via WebSocket."""
    trace_id: str | None = None

    try:
        # data fields are already validated as UUIDs by GetRubricRegenerationRunContextAndCreateRunApiRequest
        # (Pydantic auto-converts strings to UUIDs)
        department_id = data.department_id
        rubric_agent_id = data.rubric_agent_id
        rubric_id = data.rubric_id
        group_id = data.group_id  # REQUIRED for regeneration
        user_instructions = data.user_instructions

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits, creates run, gets rubric structure, gets all previous messages,
            # and links existing system/developer messages atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetRubricRegenerationRunContextAndCreateRunSqlParams(
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                    rubric_agent_id=rubric_agent_id,
                    group_id=group_id,  # REQUIRED for regeneration (uses existing group)
                    rubric_id=rubric_id,  # REQUIRED to get rubric structure
                    user_instructions=user_instructions,
                )
                result = cast(
                    GetRubricRegenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
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
                    await emit_to_internal(
                        "rubric_error",
                        RubricGenerationErrorApiRequest(
                            rubric_id=rubric_id if rubric_id else None,
                            error_message=user_msg,
                        ),
                        sid=sid,
                    )
                    return
                await emit_to_internal(
                    "rubric_error",
                    RubricGenerationErrorApiRequest(
                        rubric_id=rubric_id if rubric_id else None,
                        error_message=f"Failed to initialize rubric regeneration: {str(e)}",
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "rubric_error",
                    RubricGenerationErrorApiRequest(
                        rubric_id=rubric_id if rubric_id else None,
                        error_message=f"No rubric agent configured for department {data.department_id}",
                    ),
                    sid=sid,
                )
                return

            # result.group_id and result.trace_id come from groups table
            trace_id = (
                result.trace_id or ""
            )  # From groups.trace_id (never NULL due to DEFAULT)
            if not result.group_id:
                await emit_to_internal(
                    "rubric_error",
                    RubricGenerationErrorApiRequest(
                        rubric_id=rubric_id if rubric_id else None,
                        error_message="Failed to retrieve group information",
                    ),
                    sid=sid,
                )
                return
            group_id = result.group_id  # Uses existing group

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Get rubric structure from result (already properly typed as composite types)
            standard_groups_objects = result.standard_groups or []
            standards_objects = result.standards or []

            # Get previous messages from result (already properly typed as composite types)
            previous_messages: list[TResponseInputItem] = []
            if result.previous_messages:
                previous_messages = [
                    cast(
                        TResponseInputItem,
                        {
                            "role": msg.role or "",
                            "content": msg.content or "",
                        },
                    )
                    for msg in result.previous_messages
                ]

            # Emit start event via internal bus
            # trace_id comes from groups table via SQL, not passed in payload
            await emit_to_internal(
                "rubric_progress",
                RubricGenerationProgressApiRequest(
                    rubric_id=rubric_id if rubric_id else None,
                    progress_type="start",
                    message="Starting rubric regeneration",
                ),
                sid=sid,
                group_id=str(group_id),
            )

            # Build context dict
            context = {
                "agent_id": result.agent_id,
                "agent_name": result.agent_name,
                "system_prompt": result.system_prompt,
                "temperature": float(result.temperature)
                if result.temperature is not None
                else 0.0,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "model_name": result.model_name,
                "provider": result.provider,
                "base_url": result.base_url,
                "api_key": result.api_key,
                "profile_id": result.profile_id,
            }

            # Create rubric generation tool
            async def standard_description(
                descriptions: list[dict[str, Any]] = Field(
                    description="Array of descriptions for each grid cell. Each item should have standard_group_id, standard_id, and description fields."
                ),
            ) -> str:
                """Generate descriptions for rubric grid cells.

                For each combination of standard group and standard, generate a clear,
                specific description that describes what performance looks like at that
                level for that dimension.

                Args:
                    descriptions: Array of objects with:
                        - standard_group_id: UUID string of the standard group
                        - standard_id: UUID string of the standard
                        - description: Generated description text for this grid cell

                Returns:
                    Confirmation message
                """
                # Convert descriptions to composite type objects
                description_objects = [
                    IUpdateStandardDescriptionsV4Description(
                        standard_group_id=uuid.UUID(desc["standard_group_id"]),
                        standard_id=uuid.UUID(desc["standard_id"]),
                        description=desc["description"],
                    )
                    for desc in descriptions
                ]

                # Emit to internal bus with type-safe payload
                # rubric_id is required for UpdateStandardDescriptionsApiRequest
                if not rubric_id:
                    raise ValueError(
                        "rubric_id is required for updating standard descriptions"
                    )
                # Type narrowing: rubric_id is guaranteed to be UUID here
                rubric_id_uuid: uuid.UUID = rubric_id
                payload = UpdateStandardDescriptionsApiRequest(
                    rubric_id=rubric_id_uuid,
                    descriptions=description_objects,
                )
                await emit_to_internal(
                    "rubric_tool_standard_description",
                    payload,
                    sid=sid,
                    group_id=str(group_id),
                )

                return (
                    f"Generated {len(descriptions)} standard descriptions successfully"
                )

            rubric_tools = [function_tool(standard_description)]

            # Build rubric agent with tools
            rubric_agent = GenericAgent(
                agent_name=context["agent_name"],  # type: ignore
                system_prompt=context["system_prompt"],  # type: ignore
                temperature=context["temperature"],  # type: ignore
                model_name=context["model_name"],  # type: ignore
                provider=context["provider"],  # type: ignore
                base_url=context["base_url"],  # type: ignore
                api_key=context["api_key"],  # type: ignore
                reasoning=context["reasoning"],  # type: ignore
                tools=rubric_tools,  # type: ignore
                parallel_tool_calls=False,
            )

            # Build input items: previous messages + user instructions on top
            input_items: list[TResponseInputItem] = []

            # Add previous messages first (conversation history from all runs)
            input_items.extend(previous_messages)

            # Format rubric context for agent input
            # Format standard groups manually (no JSONB)
            standard_groups_text = "\n".join(
                [
                    f"  - {g.name} (ID: {g.id}, Points: {g.points}, Description: {g.description or 'N/A'})"
                    for g in standard_groups_objects
                ]
            )
            # Format standards manually (no JSONB)
            standards_text = "\n".join(
                [
                    f"  - {s.name} (ID: {s.id}, Points: {s.points}, Group ID: {s.standard_group_id})"
                    for s in standards_objects
                ]
            )
            rubric_context_text = f"""You are regenerating descriptions for a rubric grid. The rubric has the following structure:

Standard Groups:
{standard_groups_text if standard_groups_text else "  (none)"}

Standards:
{standards_text if standards_text else "  (none)"}

For each combination of standard group and standard, generate a clear, specific description (1-3 sentences) that describes what performance looks like at that level for that dimension. The description should be:
- Specific and observable (avoid vague terms)
- Aligned with the point value (higher points = better performance)
- Consistent with other descriptions in the same standard group
- Appropriate for educational rubrics

You must call the standard_description tool with an array of descriptions, where each description object contains:
- standard_group_id: The UUID string of the standard group
- standard_id: The UUID string of the standard
- description: The generated description text for this grid cell

Generate descriptions for ALL combinations of standard groups and standards."""

            # Append user instructions on top (most recent instruction goes last)
            if user_instructions and user_instructions.strip():
                input_items.append(
                    {
                        "role": "user",
                        "content": f"{rubric_context_text}\n\nUser Instructions: {user_instructions}",
                    }
                )
            else:
                # If no instructions, just add the rubric context
                input_items.append({"role": "user", "content": rubric_context_text})

            # Rate limit validation and run creation are now handled in SQL
            # (get_rubric_regeneration_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Run rubric regeneration with tracing
            # ⚠️ NOTE: trace() function's group_id parameter is the resource ID (rubric_id),
            # not the database group_id. This is for OpenAI implementation compatibility.
            with trace(
                "Rubric Agent",
                trace_id=trace_id,  # From groups table
                group_id=str(rubric_id)
                if rubric_id
                else None,  # Resource ID, not database group_id
            ):
                run_result = await Runner.run(
                    rubric_agent.agent(),
                    input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = run_result.context_wrapper.usage
            assistant_output = getattr(run_result, "final_output", None) or ""
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "rubric",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
            )

            # Emit completion event via internal bus
            # Note: Individual tool completion events are emitted separately by tool handlers
            # trace_id comes from groups table via SQL, not passed in payload
            await emit_to_internal(
                "rubric_complete",
                RubricGenerationCompleteApiRequest(
                    rubric_id=rubric_id if rubric_id else None,
                    message="Rubric regeneration completed successfully",
                ),
                sid=sid,
                group_id=str(group_id),
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="rubrics.regenerated",
                    template="{{ actor.name }} regenerated rubric descriptions",
                    context={
                        "department_id": str(department_id),
                        "rubric_id": str(rubric_id) if rubric_id else None,
                    },
                    endpoint="/socket/v4/rubrics/regenerate",
                    error=False,
                )
            except Exception:
                pass

    except RuntimeError:
        # Pool not initialized - emit error event
        # trace_id comes from groups table via SQL, not passed in payload
        await emit_to_internal(
            "rubric_error",
            RubricGenerationErrorApiRequest(
                rubric_id=rubric_id if rubric_id else None,
                error_message="Database connection pool not available",
            ),
            sid=sid,
            group_id=str(group_id) if group_id else None,
        )
    except Exception as e:
        # trace_id comes from groups table via SQL, not passed in payload
        await emit_to_internal(
            "rubric_error",
            RubricGenerationErrorApiRequest(
                rubric_id=rubric_id if rubric_id else None,
                error_message=str(e),
            ),
            sid=sid,
            group_id=str(group_id) if group_id else None,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="rubrics.regenerated",
                template="{{ actor.name }} failed to regenerate rubric descriptions",
                context={"error": str(e)},
                endpoint="/socket/v4/rubrics/regenerate",
                error=True,
            )
        except Exception:
            pass


@sio.event  # type: ignore
async def rubric_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GetRubricRegenerationRunContextAndCreateRunApiRequest,
        handler=_rubric_regenerate_impl,  # type: ignore[arg-type]
        error_event_name="rubrics_generation_error",
        error_response_type=RubricGenerationErrorSqlRow,
    )


register_client_endpoint(
    client_router,
    "/regenerate",
    GetRubricRegenerationRunContextAndCreateRunApiRequest,
    "Regenerate rubric descriptions using AI",
)
