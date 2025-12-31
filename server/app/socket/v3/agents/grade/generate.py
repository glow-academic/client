"""Handler for simulation_grading_start WebSocket event."""

import json
import uuid
from datetime import UTC
from typing import Any

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
from pydantic import BaseModel, Field, ValidationError
from utils.agents.create_safe_field_name import create_safe_field_name
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.chat.format_chat_scenario import format_chat_scenario
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.debug.debug_info import debug_info as debug_info_tool
from app.main import get_internal_sio, get_pool, sio

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

            # Get all grading context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            # Pattern: All AI operations use atomic context+run creation SQL files
            # See WEBSOCKET_STANDARDS.md for details
            sql = load_sql(
                "app/sql/v3/grading/get_grading_run_context_and_create_run.sql"
            )
            sql_query = sql
            sql_params = (str(simulation_chat_id), str(department_id))
            try:
                context_row = await conn.fetchrow(sql, *sql_params)
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
                    await simulation_grading_progress(
                        SimulationGradingProgressPayload(
                            type="error",
                            chat_id=str(simulation_chat_id),
                            message=user_msg,
                            error=user_msg,
                        ),
                        room=f"simulation_{simulation_chat_id}",
                    )
                    return
                # Log run creation failures for debugging
                logger.error(
                    f"Failed to get context and create run for grading {simulation_chat_id}: {str(e)}",
                    exc_info=True,
                )
                await simulation_grading_progress(
                    SimulationGradingProgressPayload(
                        type="error",
                        chat_id=str(simulation_chat_id),
                        message=f"Failed to initialize grading: {str(e)}",
                        error=str(e),
                    ),
                    room=f"simulation_{simulation_chat_id}",
                )
                return

            if not context_row:
                raise ValueError(
                    f"Chat {simulation_chat_id} not found or no grading agent configured"
                )

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(context_row["run_id"])

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
            sql_messages = load_sql(
                "app/sql/v3/simulations/get_simulation_messages.sql"
            )
            message_rows = await conn.fetch(sql_messages, str(simulation_chat_id))
            messages = [dict(row) for row in message_rows]

            input_items: list[TResponseInputItem] = []

            # prepare conversation history from chat_id
            # Always enable message numbering for grading so agent can reference messages
            has_audio_messages = any(msg.get("audio", False) for msg in messages)
            grade_voice_agent_id = context_row.get("grade_voice_agent_id")

            # Always enable message numbering for grading (inlined from get_simulation_conversation_history)
            from datetime import datetime

            include_message_numbers = True
            conversation_history: list[TResponseInputItem] = []
            message_id_map: dict[str, int] = {}
            message_number = 1

            # Filter out error messages and make a list of all items
            items = [
                msg
                for msg in messages
                if not msg.get("content", "").startswith("Error:")
            ]

            # sort items by created_at
            items = sorted(items, key=lambda x: x.get("created_at", datetime.min))

            # Group messages by type to handle consecutive responses
            current_response_messages: list[dict[str, Any]] = []

            for item in items:
                # Handle both "type" (legacy/test) and "role" (database) fields
                msg_type = item.get("type", "")
                msg_role = item.get("role", "")
                msg_content = item.get("content", "")
                message_id = item.get("id", "")

                # Check if this is a user message (type="query" or role="user")
                is_user_message = (
                    msg_type == "query" or msg_role == "user"
                ) and msg_content != ""

                if is_user_message:
                    # If we have pending response messages, add the latest one
                    if current_response_messages:
                        latest_response = current_response_messages[-1]
                        response_id = latest_response.get("id", "")
                        content = latest_response.get("content", "")

                        if include_message_numbers:
                            content = f"[{message_number}] {content}"
                            if response_id:
                                message_id_map[response_id] = message_number
                            message_number += 1

                        assistant_message_item: TResponseInputItem = {
                            "role": "assistant",
                            "content": content,
                        }
                        conversation_history.append(assistant_message_item)
                        current_response_messages = []

                    # Add the user message
                    content = msg_content
                    if include_message_numbers:
                        content = f"[{message_number}] {content}"
                        if message_id:
                            message_id_map[message_id] = message_number
                        message_number += 1

                    user_message_item: TResponseInputItem = {
                        "role": "user",
                        "content": content,
                    }
                    conversation_history.append(user_message_item)
                # Check if this is an assistant message (type="response" or role="assistant")
                elif (
                    msg_type == "response" or msg_role == "assistant"
                ) and msg_content != "":
                    # Collect response messages to find the latest one
                    current_response_messages.append(item)

            # Handle any remaining response messages at the end
            if current_response_messages:
                latest_response = current_response_messages[-1]
                response_id = latest_response.get("id", "")
                content = latest_response.get("content", "")

                if include_message_numbers:
                    content = f"[{message_number}] {content}"
                    if response_id:
                        message_id_map[response_id] = message_number
                    message_number += 1

                current_assistant_message_item: TResponseInputItem = {
                    "role": "assistant",
                    "content": content,
                }
                conversation_history.append(current_assistant_message_item)

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

            # Rate limit validation and run creation are now handled in SQL
            # (get_grading_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully
            # model_run_id is already extracted from context_row above

            # Create grade record at START with placeholder values
            # Tools will insert feedbacks as they're called
            sql_create_grade = load_sql("app/sql/v3/grading/create_grade_complete.sql")
            rubric_grade_agent_id = context_row.get("rubric_grade_agent_id")
            if not rubric_grade_agent_id:
                raise ValueError("rubric_grade_agent_id not found in context")
            grade_row = await conn.fetchrow(
                sql_create_grade,
                str(model_run_id),  # run_id
                str(rubric_grade_agent_id),  # rubric_grade_agent_id
                "",  # description (placeholder)
                False,  # passed (placeholder)
                0,  # score (placeholder)
                actual_time_taken,
            )
            if not grade_row:
                raise ValueError("Failed to create simulation chat grade")
            grade_id = uuid.UUID(grade_row["id"])

            logger.info(
                f"Created grade record {grade_id} for chat {simulation_chat_id}"
            )

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(context["agent"]["id"])
            sql_get_agent_tools = load_sql("app/sql/v3/agents/get_agent_tools.sql")
            rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
            agent_tools_config = [dict(row) for row in rows]
            tool_config_map_grading: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Create grading tools inline for each standard group
            profile_id_str = context.get("profile_id")
            grading_tools: list[Tool] = []
            total_standard_groups = len(standard_groups)

            # Get base grading tool config from database
            base_grading_config = tool_config_map_grading.get("create_grade")

            for group in standard_groups:
                safe_name = create_safe_field_name(group["short_name"])

                # Get standards for this group and build rating scale
                group_standards = [
                    s for s in standards if s["standard_group_id"] == group["id"]
                ]
                group_standards.sort(key=lambda x: x["points"], reverse=True)

                rating_scale = "\n".join(
                    [
                        f"  {std['points']} - {std['name']}: {std.get('description', '')}"
                        for std in group_standards
                    ]
                )

                full_description = (
                    f"{group.get('description', '')}\n\nRating Scale:\n{rating_scale}"
                )

                # Get descriptions from database config if available
                if base_grading_config:
                    score_desc = base_grading_config.get(
                        "argument_descriptions", {}
                    ).get("score", f"Score for {group['name']} (1-5)")
                    feedback_desc = base_grading_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "feedback", f"Feedback explaining the score for {group['name']}"
                    )
                else:
                    score_desc = f"Score for {group['name']} (1-5)"
                    feedback_desc = f"Feedback explaining the score for {group['name']}"

                # Create function with proper closure capture
                def make_grading_function(
                    group_dict: dict[str, Any],
                    full_desc: str,
                    score_descr: str,
                    feedback_descr: str,
                ):
                    async def grade_standard_group(
                        score: int = Field(ge=1, le=5, description=score_descr),
                        feedback: str = Field(default="", description=feedback_descr),
                    ) -> str:
                        """Grade the conversation on: {group_name}

                        {full_description}

                        Args:
                            score: Integer score from 1-5 based on the rubric criteria above
                            feedback: Brief feedback explaining the score with specific examples

                        Returns:
                            Confirmation message
                        """.format(
                            group_name=group_dict["name"],
                            full_description=full_desc,
                        )
                        if not grade_id:
                            return "Error: Grade ID not available"

                        from app.main import get_internal_sio

                        internal_sio = get_internal_sio()

                        # Call feedback tool handler via internal WebSocket
                        await internal_sio.emit(
                            "grading_tool_feedback",
                            {
                                "chat_id": str(simulation_chat_id),
                                "trace_id": chat["trace_id"] or "grading",
                                "grade_id": str(grade_id),
                                "standard_group_id": str(group_dict["id"]),
                                "score": score,
                                "feedback": feedback,
                                "profile_id": profile_id_str,
                            },
                        )

                        # Emit progress event
                        await emit_progress_wrapper(
                            {
                                "type": "standard_graded",
                                "chat_id": str(simulation_chat_id),
                                "standard_group_name": group_dict["name"],
                                "standard_group_short_name": group_dict["short_name"],
                                "score": score,
                                "feedback_preview": feedback[:100] + "..."
                                if len(feedback) > 100
                                else feedback,
                                "completed_count": 0,
                                "total_count": total_standard_groups,
                            }
                        )

                        logger.info(
                            f"✓ Graded {group_dict['name']}: {score}/5 - {feedback[:50]}..."
                        )
                        return f"Graded {group_dict['name']} with score {score}"

                    grade_standard_group.__name__ = f"grade_{safe_name}"
                    return grade_standard_group

                grade_func = make_grading_function(
                    group, full_description, score_desc, feedback_desc
                )
                grading_tools.append(function_tool(grade_func))
                logger.info(f"Created grading tool for: {group['name']}")

            # Add message_strength tool if grade_id and message_id_map are available
            if grade_id and message_id_map:
                message_strength_config = tool_config_map_grading.get(
                    "create_feedback_strength"
                )
                if message_strength_config:
                    message_num_desc = message_strength_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "message_number",
                        "Message number (as shown in conversation history, e.g., 1, 3, 5) to add strength feedback to",
                    )
                    feedback_desc = message_strength_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "feedback", "Description of what was strong about this message"
                    )
                    highlight_desc = message_strength_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "highlight",
                        "List of sections to highlight as strengths (e.g., ['section1', 'section2'])",
                    )
                else:
                    message_num_desc = "Message number (as shown in conversation history, e.g., 1, 3, 5) to add strength feedback to"
                    feedback_desc = "Description of what was strong about this message"
                    highlight_desc = "List of sections to highlight as strengths (e.g., ['section1', 'section2'])"

                async def message_strength(
                    message_number: int = Field(description=message_num_desc),
                    feedback: str = Field(description=feedback_desc),
                    highlight: list[str] | None = Field(
                        default=None, description=highlight_desc
                    ),
                ) -> str:
                    """Add strength feedback to a specific message."""
                    if not grade_id or not message_id_map:
                        return "Error: Grade ID or message map not available"

                    from app.main import get_internal_sio

                    internal_sio = get_internal_sio()

                    await internal_sio.emit(
                        "grading_tool_message_strength",
                        {
                            "chat_id": str(simulation_chat_id),
                            "trace_id": chat["trace_id"] or "grading",
                            "grade_id": str(grade_id),
                            "message_number": message_number,
                            "feedback": feedback,
                            "highlight": highlight or [],
                            "message_id_map": message_id_map,
                            "profile_id": profile_id_str,
                        },
                    )

                    await emit_progress_wrapper(
                        {
                            "type": "message_strength_added",
                            "chat_id": str(simulation_chat_id),
                            "message_number": message_number,
                            "feedback_preview": feedback[:100] + "..."
                            if len(feedback) > 100
                            else feedback,
                        }
                    )

                    logger.info(
                        f"✓ Added strength feedback to message {message_number}"
                    )
                    return f"Strength feedback added to message {message_number}"

                grading_tools.append(function_tool(message_strength))
                logger.info("Created message_strength tool")

                # Add message_improvement tool
                message_improvement_config = tool_config_map_grading.get(
                    "create_feedback_improvement"
                )
                if message_improvement_config:
                    message_num_desc = message_improvement_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "message_number",
                        "Message number (as shown in conversation history, e.g., 1, 3, 5) to add improvement feedback to",
                    )
                    feedback_desc = message_improvement_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "feedback",
                        "Description of what could be improved about this message",
                    )
                    strike_desc = message_improvement_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "strike",
                        "List of find/replace pairs for strikethrough suggestions (e.g., [{'find': 'keyword', 'replace': 'better keyword'}])",
                    )
                else:
                    message_num_desc = "Message number (as shown in conversation history, e.g., 1, 3, 5) to add improvement feedback to"
                    feedback_desc = (
                        "Description of what could be improved about this message"
                    )
                    strike_desc = "List of find/replace pairs for strikethrough suggestions (e.g., [{'find': 'keyword', 'replace': 'better keyword'}])"

                async def message_improvement(
                    message_number: int = Field(description=message_num_desc),
                    feedback: str = Field(description=feedback_desc),
                    strike: list[dict[str, str]] | None = Field(
                        default=None, description=strike_desc
                    ),
                ) -> str:
                    """Add improvement feedback to a specific message."""
                    if not grade_id or not message_id_map:
                        return "Error: Grade ID or message map not available"

                    from app.main import get_internal_sio

                    internal_sio = get_internal_sio()

                    await internal_sio.emit(
                        "grading_tool_message_improvement",
                        {
                            "chat_id": str(simulation_chat_id),
                            "trace_id": chat["trace_id"] or "grading",
                            "grade_id": str(grade_id),
                            "message_number": message_number,
                            "feedback": feedback,
                            "strike": strike or [],
                            "message_id_map": message_id_map,
                            "profile_id": profile_id_str,
                        },
                    )

                    await emit_progress_wrapper(
                        {
                            "type": "message_improvement_added",
                            "chat_id": str(simulation_chat_id),
                            "message_number": message_number,
                            "feedback_preview": feedback[:100] + "..."
                            if len(feedback) > 100
                            else feedback,
                        }
                    )

                    logger.info(
                        f"✓ Added improvement feedback to message {message_number}"
                    )
                    return f"Improvement feedback added to message {message_number}"

                grading_tools.append(function_tool(message_improvement))
                logger.info("Created message_improvement tool")

            # Add audio grading tool if audio messages exist and audio agent is configured
            if has_audio_messages and grade_voice_agent_id:
                from app.socket.v3.tools.audio.call import _grading_tool_audio_impl

                grade_audio_config = tool_config_map_grading.get("create_analysis")
                if grade_audio_config:
                    message_nums_desc = grade_audio_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "message_numbers",
                        "List of message numbers (as shown in conversation history, e.g., [1, 3, 5]) that have audio you want to analyze",
                    )
                    what_to_analyze_desc = grade_audio_config.get(
                        "argument_descriptions", {}
                    ).get(
                        "what_to_analyze",
                        "Description of what you want to analyze in the audio (e.g., 'tone and clarity', 'emotional state', 'speech patterns')",
                    )
                else:
                    message_nums_desc = "List of message numbers (as shown in conversation history, e.g., [1, 3, 5]) that have audio you want to analyze"
                    what_to_analyze_desc = "Description of what you want to analyze in the audio (e.g., 'tone and clarity', 'emotional state', 'speech patterns')"

                async def grade_audio(
                    message_numbers: list[int] = Field(description=message_nums_desc),
                    what_to_analyze: str = Field(description=what_to_analyze_desc),
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
                # No longer require summary tool
                required_tools = []
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

            # Rate limit validation and run creation are now handled in SQL
            # (get_grading_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully
            # model_run_id is already extracted from context_row above

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
            # Pattern: All AI operations must emit log_run event after completion
            # See WEBSOCKET_STANDARDS.md for details
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

            logger.info("Grading agent completed successfully")

            # Calculate overall score from feedbacks in database
            sql_get_feedbacks = load_sql(
                "app/sql/v3/grading/get_feedback_totals_for_grade.sql"
            )
            feedback_rows = await conn.fetch(sql_get_feedbacks, str(grade_id))
            overall_score = sum(row["total"] for row in feedback_rows)

            passed = overall_score >= rubric["pass_points"]

            # Get description from final output (no summary tool anymore)
            summary = getattr(result, "final_output", None) or ""

            # Update grade record with final values
            sql_update_grade = load_sql("app/sql/v3/grading/update_grade_final.sql")
            await conn.execute(
                sql_update_grade,
                str(grade_id),
                summary,
                passed,
                overall_score,
            )

            # 3. Mark chat as completed
            sql_mark_completed = load_sql(
                "app/sql/v3/simulations/mark_chat_completed.sql"
            )
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
