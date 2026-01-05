"""Handler for rubric_generate WebSocket event."""

import asyncio
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
    GetRubricRunContextAndCreateRunApiRequest,
    GetRubricRunContextAndCreateRunSqlParams,
    GetRubricRunContextAndCreateRunSqlRow,
    IUpdateStandardDescriptionsV4Description,
    RubricGenerationErrorApiRequest,
    RubricGenerationErrorSqlRow,
    RubricGenerationProgressApiRequest,
    UpdateStandardDescriptionsApiRequest,
)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/rubric/get_rubric_run_context_and_create_run_complete.sql"

internal_sio = get_internal_sio()


async def _rubric_generate_impl(
    sid: str, data: GetRubricRunContextAndCreateRunApiRequest, profile_id: uuid.UUID
) -> None:
    """Handle rubric generation requests via WebSocket."""
    trace_id: str | None = None

    try:
        # data fields are already validated as UUIDs by GetRubricRunContextAndCreateRunApiRequest
        # (Pydantic auto-converts strings to UUIDs)
        department_id = data.department_id
        rubric_agent_id = data.rubric_agent_id
        rubric_id = data.rubric_id

        # data.standard_groups and data.standards are already validated as composite type objects
        # by GetRubricRunContextAndCreateRunApiRequest (Pydantic auto-converts dicts to models)
        standard_groups_objects = data.standard_groups or []
        standards_objects = data.standards or []

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetRubricRunContextAndCreateRunSqlParams(
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                    rubric_agent_id=rubric_agent_id,
                    group_id=None,  # NULL for new group
                    rubric_id=rubric_id,
                    standard_groups=standard_groups_objects
                    if standard_groups_objects
                    else None,
                    standards=standards_objects if standards_objects else None,
                )
                result = cast(
                    GetRubricRunContextAndCreateRunSqlRow,
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
                        error_message=f"Failed to initialize rubric generation: {str(e)}",
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
            trace_id = result.trace_id  # From groups.trace_id
            group_id = result.group_id  # Created by SQL

            # Emit start event via internal bus
            # trace_id comes from groups table via SQL, not passed in payload
            await emit_to_internal(
                "rubric_progress",
                RubricGenerationProgressApiRequest(
                    rubric_id=rubric_id if rubric_id else None,
                    progress_type="start",
                    message="Starting rubric generation",
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

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Load agent tools from database
            from app.sql.types import GetAgentToolsSqlRow

            agent_id_uuid = uuid.UUID(context["agent_id"])
            # Function returns multiple rows, so we call it directly with fetch()
            function_call_sql = 'SELECT * FROM "public"."socket_get_agent_tools_v4"($1)'
            rows = await conn.fetch(function_call_sql, agent_id_uuid)
            agent_tools_config = [
                GetAgentToolsSqlRow.model_validate(dict(row)).model_dump()
                for row in rows
            ]
            tool_config_map_rubric: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Build rubric structure context for the agent (convert back to dicts for JSON serialization)
            # Use snake_case to match server convention (server is source of truth)
            rubric_context = {
                "standard_groups": [
                    {
                        "id": g.id,
                        "name": g.name,
                        "description": g.description,
                        "points": g.points,
                    }
                    for g in standard_groups_objects
                ],
                "standards": [
                    {
                        "id": s.id,
                        "name": s.name,
                        "points": s.points,
                        "standard_group_id": s.standard_group_id,
                    }
                    for s in standards_objects
                ],
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

            # Create title tool
            title_config = tool_config_map_rubric.get("create_title")
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
                """Create a descriptive title for this rubric."""
                # Emit to internal bus for title creation
                await internal_sio.emit(
                    "rubric_tool_title",
                    {
                        "sid": sid,
                        "trace_id": trace_id,
                        "title": title,
                        "rubric_id": str(rubric_id) if rubric_id else None,
                    },
                )
                return "Created title successfully"

            rubric_tools = [
                function_tool(standard_description),
                function_tool(create_title),
            ]

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

            # Format rubric context for agent input
            # Format standard groups manually (no JSONB)
            standard_groups_text = "\n".join(
                [
                    f"  - {g.name} (ID: {g.id}, Points: {g.points}, Description: {g.description or 'N_A'})"
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
            rubric_context_text = f"""You are generating descriptions for a rubric grid. The rubric has the following structure:

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

            # Construct input items for the agent
            input_items: list[TResponseInputItem] = [
                {
                    "role": "user",
                    "content": rubric_context_text,
                }
            ]

            # Rate limit validation and run creation are now handled in SQL
            # (get_rubric_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Track tool calls for this rubric run
            tool_calls_dict: dict[str, dict[str, Any]] = {}
            fake_id_to_real_id: dict[str, str] = {}
            tool_call_counter = 0

            # Run rubric generation with streaming
            # ⚠️ NOTE: trace() function's group_id parameter is the resource ID (rubric_id),
            # not the database group_id. This is for OpenAI implementation compatibility.
            with trace(
                "Rubric Agent",
                trace_id=trace_id,  # From groups table
                group_id=str(rubric_id)
                if rubric_id
                else None,  # Resource ID, not database group_id
            ):
                result_runner = Runner.run_streamed(
                    rubric_agent.agent(),
                    input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Store the result in active runs for potential cancellation
            from app.infra.v4.websocket.store_active_run import store_active_run

            await store_active_run(str(rubric_id) if rubric_id else sid, result_runner)

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
                                        real_item_id = f"rubric_{tool_call_counter}_{uuid.uuid4().hex[:8]}"
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
                                                "rubric_progress",
                                                {
                                                    "sid": sid,
                                                    "type": "tool_call_start",
                                                    "rubric_id": str(rubric_id)
                                                    if rubric_id
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
                                    "rubric_progress",
                                    {
                                        "sid": sid,
                                        "type": "tool_call_progress",
                                        "rubric_id": str(rubric_id)
                                        if rubric_id
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
                                    "rubric_complete",
                                    {
                                        "sid": sid,
                                        "type": "tool_call_complete",
                                        "rubric_id": str(rubric_id)
                                        if rubric_id
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

                await remove_active_run(str(rubric_id) if rubric_id else sid)

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = result_runner.context_wrapper.usage
            assistant_output = getattr(result_runner, "final_output", None) or ""
            await internal_sio.emit(
                "log_run",
                {
                    "run_id": str(model_run_id),
                    "operation_type": "rubric",
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": context.get("system_prompt"),
                    "input_items": input_items,  # Serialized TResponseInputItem list
                    "assistant_output": assistant_output,
                    "department_id": str(department_id) if department_id else None,
                },
            )

            # Emit run completion event (dispatched by complete.py)
            await internal_sio.emit(
                "rubric_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "rubric_id": str(rubric_id) if rubric_id else None,
                    "run_id": str(model_run_id),
                    "message": "Rubric generation completed successfully",
                },
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="rubrics.generated",
                    template="{{ actor.name }} generated rubric descriptions",
                    context={
                        "department_id": str(department_id),
                        "rubric_id": str(rubric_id) if rubric_id else None,
                    },
                    endpoint="/socket/v4/rubrics/generate",
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
                event_key="rubrics.generated",
                template="{{ actor.name }} failed to generate rubric descriptions",
                context={"error": str(e)},
                endpoint="/socket/v4/rubrics/generate",
                error=True,
            )
        except Exception:
            pass


@sio.event  # type: ignore
async def rubric_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GetRubricRunContextAndCreateRunApiRequest,
        handler=_rubric_generate_impl,  # type: ignore[arg-type]
        error_event_name="rubrics_generation_error",
        error_response_type=RubricGenerationErrorSqlRow,
    )


register_client_endpoint(
    client_router,
    "/generate",
    GetRubricRunContextAndCreateRunApiRequest,
    "Generate rubric descriptions using AI",
)
