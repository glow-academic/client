"""Handler for simulation_grading_start WebSocket event."""

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    ToolsToFinalOutputResult,
    trace,
)
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_grading_storage, get_internal_sio, get_pool, sio
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_grading_tools import create_grading_tools
from app.utils.agents.tools.create_safe_field_name import create_safe_field_name
from app.utils.chat.format_chat_scenario import format_chat_scenario
from app.utils.chat.get_simulation_conversation_history import (
    get_simulation_conversation_history,
)
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from app.utils.storage.request_storage import build_storage_key

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class SimulationGradingStartPayload(BaseModel):
    """Request to start grading for a simulation chat."""

    chat_id: str
    department_id: str
    sid: str | None = None  # Optional: WebSocket session ID for room targeting


class SimulationGradingProgressPayload(BaseModel):
    """Response indicating progress in simulation grading."""

    type: str
    chat_id: str
    message: str | None = None
    error: str | None = None
    rubric_name: str | None = None
    standards_count: int | None = None
    grade_id: str | None = None
    total_score: float | None = None
    passed: bool | None = None
    standards_graded: int | None = None
    time_taken: float | None = None
    summary: str | None = None
    standard_group_name: str | None = None
    standard_group_short_name: str | None = None
    score: int | None = None
    feedback_preview: str | None = None
    completed_count: int | None = None
    total_count: int | None = None
    summary_preview: str | None = None


# Emit helper functions
async def simulation_grading_progress(
    payload: SimulationGradingProgressPayload, room: str
) -> None:
    await sio.emit(
        "simulations_text_grading_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def _simulation_grading_start_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for starting simulation grading."""
    logger.info(
        f"[simulation_grading_start] Handler received event: sid={sid}, "
        f"data={data}, chat_id={data.get('chat_id', 'unknown')}"
    )
    try:
        validated = SimulationGradingStartPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_grading_start for {sid}: {e}")
        await simulation_grading_progress(
            SimulationGradingProgressPayload(
                type="error",
                chat_id=data.get("chat_id", "unknown"),
                message=f"Invalid payload: {str(e)}",
                error=str(e),
            ),
            room=f"simulation_{data.get('chat_id', 'unknown')}",
        )
        return

    chat_id = validated.chat_id
    department_id_str = validated.department_id

    pool = get_pool()
    if not pool:
        await simulation_grading_progress(
            SimulationGradingProgressPayload(
                type="error",
                chat_id=chat_id,
                message="Database connection pool not available",
                error="Database connection pool not available",
            ),
            room=f"simulation_{chat_id}",
        )
        return

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            simulation_chat_id = uuid.UUID(chat_id)
            department_id = uuid.UUID(department_id_str)

            # Initialize grading tracking dictionaries
            grading_results: dict[str, Any] = {}
            grading_progress: dict[str, bool] = {}
            grading_results.clear()
            grading_progress.clear()

            # Get all grading context data in one optimized query using SQL file
            sql = load_sql("sql/v3/agents/get_grading_run_context.sql")
            sql_query = sql
            sql_params = (str(simulation_chat_id), str(department_id))
            context_row = await conn.fetchrow(sql, *sql_params)

            if not context_row:
                raise ValueError(
                    f"Chat {simulation_chat_id} not found or no grading agent configured"
                )

            # Parse JSON arrays for standard_groups and standards
            standard_groups_json = (
                json.loads(context_row["standard_groups"])
                if isinstance(context_row["standard_groups"], str)
                else context_row["standard_groups"]
            )
            standards_json = (
                json.loads(context_row["standards"])
                if isinstance(context_row["standards"], str)
                else context_row["standards"]
            )

            context = {
                "chat_id": context_row["chat_id"],
                "scenario_id": context_row["scenario_id"],
                "attempt_id": context_row["attempt_id"],
                "title": context_row["title"],
                "trace_id": context_row["trace_id"],
                "created_at": context_row["chat_created_at"],
                "completed": context_row["completed"],
                "problem_statement": context_row["problem_statement"],
                "simulation_id": context_row["simulation_id"],
                "total_chats": context_row["total_chats"],
                "time_limit": context_row["time_limit"],
                "rubric": {
                    "id": context_row["rubric_id"],
                    "name": context_row["rubric_name"],
                    "description": context_row["rubric_description"],
                    "points": context_row["rubric_points"],
                    "pass_points": context_row["rubric_pass_points"],
                },
                "standard_groups": standard_groups_json,
                "standards": standards_json,
                "agent": {
                    "id": context_row["agent_id"],
                    "name": context_row["agent_name"],
                    "system_prompt": context_row["system_prompt"],
                    "temperature": float(context_row["temperature"])
                    if context_row["temperature"] is not None
                    else 0.0,
                    "reasoning": context_row["reasoning"],
                },
                "model": {
                    "id": context_row["model_id"],
                    "name": context_row["model_name"],
                    "custom_model": context_row["custom_model"],
                },
                "provider": {
                    "id": context_row["provider_id"],
                    "name": context_row["provider_name"],
                    "base_url": context_row["base_url"],
                    "api_key": context_row["api_key"],
                },
                "profile_id": context_row["profile_id"],
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
                "grade_voice_agent_id": context_row.get("grade_voice_agent_id"),
            }

            # Extract data from context
            chat = {
                "id": uuid.UUID(context["chat_id"]),
                "scenario_id": uuid.UUID(context["scenario_id"]),
                "attempt_id": uuid.UUID(context["attempt_id"]),
                "title": context["title"],
                "trace_id": context["trace_id"],
            }

            attempt = {
                "id": uuid.UUID(context["attempt_id"]),
                "simulation_id": uuid.UUID(context["simulation_id"]),
            }

            simulation = {
                "id": uuid.UUID(context["simulation_id"]),
                "rubric_id": uuid.UUID(context["rubric"]["id"]),
                "time_limit": context["time_limit"],
                "department_id": department_id,
            }

            rubric = {
                "id": uuid.UUID(context["rubric"]["id"]),
                "name": context["rubric"]["name"],
                "description": context["rubric"]["description"],
                "points": context["rubric"]["points"],
                "pass_points": context["rubric"]["pass_points"],
            }

            rubric_id = rubric["id"]

            # Convert standard_groups and standards from JSON to dicts with UUID conversion
            standard_groups = []
            for sg in context["standard_groups"]:
                standard_groups.append(
                    {
                        "id": uuid.UUID(sg["id"]),
                        "name": sg["name"],
                        "short_name": sg["short_name"],
                        "description": sg["description"],
                        "points": sg["points"],
                        "pass_points": sg["pass_points"],
                        "rubric_id": uuid.UUID(sg["rubric_id"]),
                    }
                )

            standards = []
            for std in context["standards"]:
                standards.append(
                    {
                        "id": uuid.UUID(std["id"]),
                        "name": std["name"],
                        "description": std["description"],
                        "points": std["points"],
                        "standard_group_id": uuid.UUID(std["standard_group_id"]),
                    }
                )

            # Get messages using SQL file
            sql_messages = load_sql("sql/v3/simulations/get_simulation_messages.sql")
            message_rows = await conn.fetch(sql_messages, str(simulation_chat_id))
            messages = [dict(row) for row in message_rows]

            input_items: list[TResponseInputItem] = []

            # prepare conversation history from chat_id
            # Check if any messages have audio and if grade_voice_agent_id is available
            has_audio_messages = any(msg.get("audio", False) for msg in messages)
            grade_voice_agent_id = context_row.get("grade_voice_agent_id")

            # Use message numbering if audio messages exist and audio agent is configured
            include_message_numbers = (
                has_audio_messages and grade_voice_agent_id is not None
            )
            conversation_history, message_id_map = get_simulation_conversation_history(
                messages, include_message_numbers=include_message_numbers
            )

            # Format scenario from context
            chat_scenario = format_chat_scenario(context["problem_statement"])

            input_items.insert(0, chat_scenario)
            input_items.extend(conversation_history)

            logger.info(
                f"Starting grading for simulation chat {simulation_chat_id} with rubric {rubric['name']}"
            )
            logger.info(
                f"Found {len(standard_groups)} standard groups and {len(standards)} standards"
            )

            # Emit grading start event
            await simulation_grading_progress(
                SimulationGradingProgressPayload(
                    type="start",
                    chat_id=str(simulation_chat_id),
                    message="Starting grading process",
                    rubric_name=rubric["name"],
                    standards_count=len(standard_groups),
                ),
                room=f"simulation_{simulation_chat_id}",
            )
            logger.info(f"Emitted grading start event for chat {simulation_chat_id}")

            # Build dynamic rubric
            rubric_lines = [
                f"RUBRIC: {rubric['name']}",
                f"Description: {rubric.get('description', '')}",
                f"Total Points: {rubric['points']}",
                f"Pass Points: {rubric['pass_points']}",
                "",
                "EVALUATION CRITERIA:",
                "",
            ]

            # Group standards by standard_group_id
            standards_by_group: dict[Any, list[dict[str, Any]]] = {}
            for standard in standards:
                group_id = standard["standard_group_id"]
                if group_id not in standards_by_group:
                    standards_by_group[group_id] = []
                standards_by_group[group_id].append(standard)

            # Build criteria sections
            for group in standard_groups:
                rubric_lines.extend(
                    [
                        f"CRITERION: {group['name']} ({group['short_name']})",
                        f"Description: {group.get('description', '')}",
                        f"Points: {group['points']} (Pass: {group['pass_points']})",
                        "Rating Scale:",
                    ]
                )

                # Sort standards by points (descending - 5 to 1)
                group_standards = standards_by_group.get(group["id"], [])
                group_standards.sort(key=lambda x: x["points"], reverse=True)

                for standard in group_standards:
                    rubric_lines.append(
                        f"  {standard['points']} - {standard['name']}: {standard.get('description', '')}"
                    )

                rubric_lines.append("")  # Empty line between criteria

            rubric_string = "\n".join(rubric_lines)

            rubric_input = {
                "role": "developer",
                "content": f"You are evaluating a conversation based on the following rubric. Please provide scores (1-5) and feedback for each criterion.\n\n{rubric_string}",
            }

            # get the time limit from the simulation
            time_limit = simulation["time_limit"] or -1

            # Calculate adjusted time limit for multi-simulation attempts
            total_chats = context["total_chats"]
            adjusted_time_limit = (
                (time_limit * 60)
                if time_limit and total_chats == 1
                else ((time_limit * 60) // total_chats)
                if time_limit
                else 0
            )

            # Get chat timestamps from context
            chat_created_at = context["created_at"]

            # Convert timestamps to UTC if they have timezone info
            if chat_created_at.tzinfo is not None:
                chat_created_at = chat_created_at.astimezone(UTC)
            else:
                chat_created_at = chat_created_at.replace(tzinfo=UTC)

            # Calculate time taken - use current time since completed_at column was removed
            current_time = datetime.now(UTC)
            actual_time_taken = max(
                1, int((current_time - chat_created_at).total_seconds())
            )

            def format_minutes(seconds: int) -> str:
                minutes = seconds // 60
                secs = seconds % 60
                return f"{minutes} min {secs} sec" if minutes > 0 else f"{secs} sec"

            # create time message
            time_message: TResponseInputItem
            if adjusted_time_limit > 0:
                time_message = {
                    "role": "developer",
                    "content": f"The adjusted time limit for this chat is {format_minutes(adjusted_time_limit)}. The TA has taken {format_minutes(actual_time_taken)} during this chat. You can take this into account when grading the TA, based on the rubric.",
                }
            else:
                time_message = {
                    "role": "developer",
                    "content": f"The TA has taken {format_minutes(actual_time_taken)} during this chat. You can take this into account when grading the TA, based on the rubric.",
                }

            # add rubric to beginning of input_items
            input_items.insert(0, time_message)
            input_items.insert(0, rubric_input)  # type: ignore[arg-type]

            # Create wrapper for emit_progress that captures chat_id
            async def emit_progress_wrapper(event_data: dict[str, Any]) -> None:
                await simulation_grading_progress(
                    SimulationGradingProgressPayload(**event_data),
                    room=f"simulation_{simulation_chat_id}",
                )

            # Create grading tools for each standard group
            profile_id_str = context.get("profile_id")
            grading_tools = create_grading_tools(
                list(standard_groups),
                list(standards),
                simulation_chat_id,
                emit_progress_wrapper,
                profile_id=str(profile_id_str) if profile_id_str else None,
            )

            # Add audio grading tool if audio messages exist and audio agent is configured
            if has_audio_messages and grade_voice_agent_id:
                from agents import function_tool
                from pydantic import Field

                from app.socket.v3.simulations.grading.tools.audio import (
                    _grading_tool_audio_impl,
                )

                async def grade_audio(
                    message_numbers: list[int] = Field(
                        description="List of message numbers (as shown in conversation history, e.g., [1, 3, 5]) that have audio you want to analyze"
                    ),
                    what_to_analyze: str = Field(
                        description="Description of what you want to analyze in the audio (e.g., 'tone and clarity', 'emotional state', 'speech patterns')"
                    ),
                ) -> str:
                    """Grade audio messages from the conversation.

                    This tool allows you to analyze audio messages from the conversation.
                    Specify which messages (by their numbers in the conversation history)
                    you want to analyze and what aspects you want to evaluate.

                    Args:
                        message_numbers: List of message numbers that have audio (e.g., [1, 3, 5])
                        what_to_analyze: Description of what to analyze in the audio

                    Returns:
                        Analysis result from the audio grading agent
                    """
                    # Call the audio handler directly to get synchronous result
                    # We'll use a special flag to return the result instead of emitting events
                    result_container: dict[str, Any] = {"result": None, "error": None}

                    async def capture_result(
                        result: str, error: str | None = None
                    ) -> None:
                        result_container["result"] = result
                        result_container["error"] = error

                    # Call handler with result callback
                    try:
                        result = await _grading_tool_audio_impl(
                            sid,
                            {
                                "chat_id": str(simulation_chat_id),
                                "trace_id": context["trace_id"],
                                "message_numbers": message_numbers,
                                "what_to_analyze": what_to_analyze,
                                "agent_id": grade_voice_agent_id,
                                "department_id": str(department_id),
                                "message_id_map": message_id_map,
                                "profile_id": profile_id_str,
                                "_result_callback": capture_result,
                            },
                        )

                        # If handler returned result directly, use it
                        if result:
                            return result

                        # Otherwise check callback result
                        if result_container["error"]:
                            return f"Error analyzing audio: {result_container['error']}"

                        if result_container["result"]:
                            return result_container["result"]

                        return "Audio analysis completed but no result was returned."
                    except Exception as e:
                        logger.error(
                            f"Error in grade_audio tool: {str(e)}", exc_info=True
                        )
                        return f"Error analyzing audio: {str(e)}"

                grading_tools.append(function_tool(grade_audio))
                logger.info("Added grade_audio tool to grading tools")

            grading_tools.append(debug_info_tool)
            logger.info(
                f"Created {len(grading_tools)} grading tools (including debug_info)"
            )

            # Create tool use behavior to check when all required tools are called
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                # Use grading_progress from outer scope
                nonlocal grading_progress
                required_tools = ["summary"]
                for group in standard_groups:
                    safe_name = create_safe_field_name(group["short_name"])
                    required_tools.append(safe_name)

                completed_required = all(
                    grading_progress.get(tool, False) for tool in required_tools
                )

                logger.info(
                    f"Tool use check: required={required_tools}, completed={completed_required}, progress={grading_progress}"
                )
                return ToolsToFinalOutputResult(is_final_output=completed_required)

            # Get agent, model, and provider from context
            agent = context["agent"]
            model = context["model"]
            provider = context["provider"]

            grading_agent = GenericAgent(
                agent_name=agent["name"],
                system_prompt=agent["system_prompt"],
                temperature=agent["temperature"],
                model_name=model["name"],
                provider=provider["name"],
                base_url=provider["base_url"],
                api_key=provider["api_key"],
                reasoning=agent["reasoning"],
                tools=grading_tools,
                parallel_tool_calls=False,
                tool_use_behavior=tool_use_behavior,
            )

            agent_instance = grading_agent.agent()

            # Check rate limit
            profile_id_uuid = (
                uuid.UUID(context["profile_id"]) if context["profile_id"] else None
            )
            if not profile_id_uuid:
                raise ValueError("Profile not found. Please contact support.")

            req_per_day = context["req_per_day"]
            runs_today_count = context["runs_today_count"]

            if req_per_day is not None and runs_today_count >= req_per_day:
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
                    error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                raise ValueError(error_message)

            # Create model run with all junction records using SQL file
            sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                str(department_id),
                model["id"],
                agent["id"],
                "agent",
                context["profile_id"],
                None,  # key_id
                str(agent["id"]),  # agent_id
            )
            model_run_id = uuid.UUID(model_run_row["run_id"])

            # Run the grading
            logger.info("Running grading agent...")
            with trace(
                chat["title"], trace_id=chat["trace_id"], group_id=str(attempt["id"])
            ):
                result = await Runner.run(
                    agent_instance,
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = result.context_wrapper.usage
            assistant_output = getattr(result, "final_output", None) or ""
            rubric_dev_content = str(rubric_input.get("content", ""))
            time_dev_content = str(time_message.get("content", ""))
            # Create input_items with developer messages for logging
            input_items_with_dev = input_items + [
                {"role": "developer", "content": rubric_dev_content},
                {"role": "developer", "content": time_dev_content},
            ]
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "simulation_grade",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": agent["system_prompt"],
                    "inputItems": input_items_with_dev,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
            )

            # Extract results from request-scoped storage
            profile_id_str = context.get("profile_id")
            if not profile_id_str:
                raise ValueError("Profile ID not found in context")

            storage = get_grading_storage()
            storage_key = build_storage_key(
                operation_type="grading",
                profile_id=str(profile_id_str),
                primary_id=str(simulation_chat_id),
            )
            grading_result = await storage.get_all(storage_key)

            logger.info("Grading agent completed successfully")
            logger.info(f"Grading result keys: {list(grading_result.keys())}")
            logger.info(f"Grading result content: {grading_result}")

            # Calculate overall score from tool call results
            overall_score = 0
            for group in standard_groups:
                safe_name = create_safe_field_name(group["short_name"])
                group_data = grading_result.get(safe_name, {})
                score = group_data.get("score", 0)
                try:
                    overall_score += int(score)
                except (TypeError, ValueError):
                    logger.warning(
                        f"Non-integer value for {group['short_name']} ('{score}'); treating as 0"
                    )

            passed = overall_score >= rubric["pass_points"]

            # Get summary from tool call results
            summary = grading_result.get("summary", "")

            # Save grading results using SQL files
            # 1. Create grade record
            sql_create_grade = load_sql("sql/v3/grading/create_grade_complete.sql")
            grade_row = await conn.fetchrow(
                sql_create_grade,
                str(simulation_chat_id),
                str(rubric_id),
                summary,
                passed,
                overall_score,
                actual_time_taken,
            )
            if not grade_row:
                raise ValueError("Failed to create simulation chat grade")
            grade_id = uuid.UUID(grade_row["id"])

            # 2. Create feedback records
            feedback_records = []
            for group in standard_groups:
                safe_name = create_safe_field_name(group["short_name"])
                group_data = grading_result.get(safe_name, {})
                group_score = group_data.get("score", 0)
                group_feedback = group_data.get("feedback", "")

                # Find the corresponding standard for this score
                group_standards = [
                    s for s in standards if s["standard_group_id"] == group["id"]
                ]
                matching_standard = None
                for standard in group_standards:
                    if standard["points"] == group_score:
                        matching_standard = standard
                        break

                if matching_standard:
                    feedback_records.append(
                        {
                            "standard_id": str(matching_standard["id"]),
                            "total": group_score,
                            "feedback": group_feedback,
                        }
                    )

            if feedback_records:
                feedbacks_json = json.dumps(feedback_records)
                sql_create_feedbacks = load_sql(
                    "sql/v3/grading/create_feedbacks_complete.sql"
                )
                await conn.execute(sql_create_feedbacks, str(grade_id), feedbacks_json)

            # 3. Mark chat as completed
            sql_mark_completed = """
                UPDATE simulation_chats
                SET completed = true
                WHERE id = $1::uuid
            """
            await conn.execute(sql_mark_completed, str(simulation_chat_id))

            logger.info(
                f"Saved grading results with {len(standard_groups)} feedback records"
            )

            # Emit grading completion event
            await simulation_grading_progress(
                SimulationGradingProgressPayload(
                    type="complete",
                    chat_id=str(simulation_chat_id),
                    message="Grading completed successfully",
                    grade_id=str(grade_id),
                    total_score=overall_score,
                    passed=passed,
                    standards_graded=len(standard_groups),
                    time_taken=actual_time_taken,
                    summary=summary,
                ),
                room=f"simulation_{simulation_chat_id}",
            )
            logger.info(
                f"Emitted grading completion event for chat {simulation_chat_id}"
            )

            logger.info(f"Grading completed successfully with grade ID: {grade_id}")

    except Exception as e:
        logger.error(f"Error in grading agent: {str(e)}", exc_info=True)

        # Emit error event
        try:
            await simulation_grading_progress(
                SimulationGradingProgressPayload(
                    type="error",
                    chat_id=chat_id,
                    message=f"Grading failed: {str(e)}",
                    error=str(e),
                ),
                room=f"simulation_{chat_id}",
            )
        except Exception as emit_err:
            logger.warning(f"Failed to emit error event: {emit_err}")


@sio.event  # type: ignore
async def simulation_grading_start(sid: str, data: dict[str, Any]) -> None:
    """Handle grading start event from client (client-to-server)."""
    await _simulation_grading_start_impl(sid, data)


@internal_sio.on("simulation_grading_start")
async def simulation_grading_start_internal(data: dict[str, Any]) -> None:
    """Handle grading start event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[simulation_grading_start_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _simulation_grading_start_impl(sid, payload)


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/start", response_model=dict[str, bool])
async def simulation_grading_start_api(
    request: SimulationGradingStartPayload,
) -> dict[str, bool]:
    """Client-to-server event: Start grading for a simulation chat."""
    return {"success": True}


@server_router.post("/progress", response_model=dict[str, bool])
async def simulation_grading_progress_api(
    request: SimulationGradingProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation grading progress update."""
    return {"success": True}
