"""Handler for simulation_grading_start WebSocket event."""

import asyncio
import uuid
from datetime import UTC, datetime
from typing import Any, cast

from agents import (FunctionToolResult, RunContextWrapper, Runner, Tool,
                    ToolsToFinalOutputResult, function_tool, trace)
from agents.items import TResponseInputItem
from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.chat.format_chat_scenario import format_chat_scenario
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.debug.debug_info import debug_info as debug_info_tool
from app.infra.v4.websocket.find_profile_by_socket import \
    find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (GetDeveloperInstructionSqlParams,
                           GetDeveloperInstructionSqlRow,
                           GetGradingRunContextAndCreateRunSqlParams,
                           GetGradingRunContextAndCreateRunSqlRow,
                           LinkDeveloperMessageToRunSqlParams)
from fastapi import APIRouter
from jinja2 import Template
from pydantic import BaseModel, Field, ValidationError
from utils.agents.create_safe_field_name import create_safe_field_name
from utils.sql_helper import execute_sql_typed, load_sql

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


async def _simulation_grading_start_impl(
    sid: str, data: SimulationGradingStartPayload, profile_id: uuid.UUID
) -> None:
    """Internal implementation for starting simulation grading."""
    chat_id = data.chat_id
    department_id_str = data.department_id

    try:
        async with get_db_connection() as conn:
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
            SQL_PATH = (
                "app/sql/v4/grading/get_grading_run_context_and_create_run_complete.sql"
            )
            try:
                params = GetGradingRunContextAndCreateRunSqlParams(
                    chat_id=simulation_chat_id,
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                )
                result = cast(
                    GetGradingRunContextAndCreateRunSqlRow,
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

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Standard groups and standards are now composite types (auto-decoded by asyncpg)
            # No need for json.loads() - they're already Python objects
            standard_groups_objects = result.standard_groups or []
            standards_objects = result.standards or []

            context = {
                "chat_id": result.chat_id,
                "scenario_id": result.scenario_id,
                "attempt_id": result.attempt_id,
                "title": result.title,
                "trace_id": result.trace_id,
                "created_at": result.chat_created_at,
                "completed": result.completed,
                "problem_statement": result.problem_statement,
                "simulation_id": result.simulation_id,
                "total_chats": result.total_chats,
                "time_limit": result.time_limit,
                "rubric": {
                    "id": result.rubric_id_out,
                    "name": result.rubric_name,
                    "description": result.rubric_description,
                    "points": result.rubric_points,
                    "pass_points": result.rubric_pass_points,
                },
                "standard_groups": standard_groups_objects,
                "standards": standards_objects,
                "agent": {
                    "id": result.agent_id,
                    "name": result.agent_name,
                    "system_prompt": result.system_prompt,
                    "temperature": float(result.temperature)
                    if result.temperature is not None
                    else 0.0,
                    "reasoning": result.reasoning,
                },
                "model": {
                    "id": result.model_id,
                    "name": result.model_name,
                    "custom_model": None,  # Not in result, set to None
                },
                "provider": {
                    "id": None,  # Not in result
                    "name": result.provider,
                    "base_url": result.base_url,
                    "api_key": result.api_key,
                },
                "profile_id": result.profile_id_out,
                "req_per_day": result.req_per_day,
                "runs_today_count": result.runs_today_count,
                "earliest_run_created_at": result.earliest_run_created_at,
                "audio_agent_id": result.audio_agent_id,
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

            # Convert standard_groups and standards from composite types to dicts with UUID conversion
            standard_groups = []
            for sg in standard_groups_objects:
                standard_groups.append(
                    {
                        "id": uuid.UUID(sg.id),
                        "name": sg.name,
                        "short_name": sg.short_name,
                        "description": sg.description,
                        "points": sg.points,
                        "pass_points": sg.pass_points,
                        "rubric_id": uuid.UUID(sg.rubric_id),
                    }
                )

            standards = []
            for std in standards_objects:
                standards.append(
                    {
                        "id": uuid.UUID(std.id),
                        "name": std.name,
                        "description": std.description,
                        "points": std.points,
                        "standard_group_id": uuid.UUID(std.standard_group_id),
                    }
                )

            # Get messages using SQL file
            from app.sql.types import (GetSimulationMessagesSqlParams,
                                       GetSimulationMessagesSqlRow)

            SQL_MESSAGES_PATH = (
                "app/sql/v4/simulations/get_simulation_messages_complete.sql"
            )
            message_params = GetSimulationMessagesSqlParams(chat_id=simulation_chat_id)
            message_result = cast(
                GetSimulationMessagesSqlRow,
                await execute_sql_typed(conn, SQL_MESSAGES_PATH, params=message_params),
            )
            # Function returns a single row with messages array field
            messages_objects = message_result.messages or []
            # Convert composite type objects to dicts
            messages = [
                {
                    "id": msg.id,
                    "chat_id": msg.chat_id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at,
                    "completed": msg.completed,
                    "updated_at": msg.updated_at,
                    "audio": msg.audio == "true" if msg.audio else False,
                    "upload_id": msg.upload_id,
                }
                for msg in messages_objects
            ]

            input_items: list[TResponseInputItem] = []

            # prepare conversation history from chat_id
            # Always enable message numbering for grading so agent can reference messages
            has_audio_messages = any(msg.get("audio", False) for msg in messages)
            audio_agent_id = result.audio_agent_id

            # Always enable message numbering for grading (inlined from get_simulation_conversation_history)
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

            # Get developer instruction template for rubric from database
            rubric_message_content: str | None = None
            try:
                rubric_instruction_params = GetDeveloperInstructionSqlParams(
                    instruction_type="grade_rubric",
                    agent_role_val="grade",
                )
                rubric_instruction_result = cast(
                    GetDeveloperInstructionSqlRow,
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/developer_instructions/get_developer_instruction_complete.sql",
                        params=rubric_instruction_params,
                    ),
                )
                if rubric_instruction_result and rubric_instruction_result.template:
                    # Render Jinja template with rubric_string context
                    template = Template(rubric_instruction_result.template)
                    rubric_message_content = template.render(
                        rubric_string=rubric_string
                    )
            except Exception:
                # Fallback to hardcoded message if developer instruction not found
                rubric_message_content = f"You are evaluating a conversation based on the following rubric. Please provide scores (1-5) and feedback for each criterion.\n\n{rubric_string}"

            rubric_input = {
                "role": "developer",
                "content": rubric_message_content or "",
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

            # Get developer instruction template for time limit from database
            time_message_content: str | None = None
            try:
                time_instruction_params = GetDeveloperInstructionSqlParams(
                    instruction_type="grade_time",
                    agent_role_val="grade",
                )
                time_instruction_result = cast(
                    GetDeveloperInstructionSqlRow,
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/developer_instructions/get_developer_instruction_complete.sql",
                        params=time_instruction_params,
                    ),
                )
                if time_instruction_result and time_instruction_result.template:
                    # Render Jinja template with time context
                    template = Template(time_instruction_result.template)
                    time_message_content = template.render(
                        adjusted_time_limit=format_minutes(adjusted_time_limit)
                        if adjusted_time_limit > 0
                        else None,
                        actual_time_taken=format_minutes(actual_time_taken),
                        has_time_limit=adjusted_time_limit > 0,
                    )
            except Exception:
                # Fallback to hardcoded message if developer instruction not found
                if adjusted_time_limit > 0:
                    time_message_content = f"The adjusted time limit for this chat is {format_minutes(adjusted_time_limit)}. The TA has taken {format_minutes(actual_time_taken)} during this chat. You can take this into account when grading the TA, based on the rubric."
                else:
                    time_message_content = f"The TA has taken {format_minutes(actual_time_taken)} during this chat. You can take this into account when grading the TA, based on the rubric."

            # create time message
            time_message: TResponseInputItem = {
                "role": "developer",
                "content": time_message_content or "",
            }

            # add rubric and time messages to beginning of input_items
            input_items.insert(0, time_message)
            input_items.insert(0, rubric_input)  # type: ignore[arg-type]

            # Link developer messages to run
            try:
                if rubric_message_content:
                    rubric_link_params = LinkDeveloperMessageToRunSqlParams(
                        content=rubric_message_content,
                        run_id=model_run_id,
                    )
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/simulations/link_developer_message_to_run_complete.sql",
                        params=rubric_link_params,
                    )
                if time_message_content:
                    time_link_params = LinkDeveloperMessageToRunSqlParams(
                        content=time_message_content,
                        run_id=model_run_id,
                    )
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/simulations/link_developer_message_to_run_complete.sql",
                        params=time_link_params,
                    )
            except Exception:
                # Log error but continue - messages are already in input_items
                pass

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
            from app.sql.types import CreateGradeSqlParams, CreateGradeSqlRow

            SQL_CREATE_GRADE_PATH = "app/sql/v4/grading/create_grade_complete.sql"
            rubric_grade_agent_id = result.rubric_grade_agent_id
            if not rubric_grade_agent_id:
                raise ValueError("rubric_grade_agent_id not found in context")
            grade_params = CreateGradeSqlParams(
                run_id=model_run_id,
                rubric_grade_agent_id=uuid.UUID(rubric_grade_agent_id),
                description="",  # placeholder
                passed=False,  # placeholder
                score=0,  # placeholder
                time_taken=actual_time_taken,
            )
            grade_result = cast(
                CreateGradeSqlRow,
                await execute_sql_typed(
                    conn, SQL_CREATE_GRADE_PATH, params=grade_params
                ),
            )
            grade_id = uuid.UUID(grade_result.id)

            # Load agent tools from database
            from app.sql.types import GetAgentToolsSqlRow

            agent_id_uuid = uuid.UUID(context["agent"]["id"])
            # Function returns multiple rows, so we call it directly with fetch()
            function_call_sql = 'SELECT * FROM "public"."socket_get_agent_tools_v4"($1)'
            rows = await conn.fetch(function_call_sql, agent_id_uuid)
            agent_tools_config = [
                GetAgentToolsSqlRow.model_validate(dict(row)).model_dump()
                for row in rows
            ]
            tool_config_map_grading: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Create grading tools inline for each standard group
            profile_id_str = context.get("profile_id")
            grading_tools: list[Tool] = []
            total_standard_groups = len(standard_groups)

            # Get base grading tool config from database
            base_grading_config = tool_config_map_grading.get("create_feedback")

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

                        return f"Graded {group_dict['name']} with score {score}"

                    grade_standard_group.__name__ = f"grade_{safe_name}"
                    return grade_standard_group

                grade_func = make_grading_function(
                    group, full_description, score_desc, feedback_desc
                )
                grading_tools.append(function_tool(grade_func))
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
                    return f"Strength feedback added to message {message_number}"

                grading_tools.append(function_tool(message_strength))
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
                    return f"Improvement feedback added to message {message_number}"

                grading_tools.append(function_tool(message_improvement))
            # Add audio grading tool if audio messages exist and audio agent is configured
            if has_audio_messages and audio_agent_id:
                from app.socket.v4.agents.grade.tools.audio.call import \
                    _grading_tool_audio_impl

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
                                "agent_id": audio_agent_id,
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
                        return f"Error analyzing audio: {str(e)}"

                grading_tools.append(function_tool(grade_audio))
            grading_tools.append(debug_info_tool)

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

            # Track tool calls for this grading run
            tool_calls_dict: dict[str, dict[str, Any]] = {}
            fake_id_to_real_id: dict[str, str] = {}
            tool_call_counter = 0

            # Run the grading with streaming
            with trace(
                chat["title"], trace_id=chat["trace_id"], group_id=str(attempt["id"])
            ):
                result_runner = Runner.run_streamed(
                    agent_instance,
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Store the result in active runs for potential cancellation
            from app.infra.v4.websocket.store_active_run import \
                store_active_run

            await store_active_run(str(simulation_chat_id), result_runner)

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
                                        real_item_id = f"{simulation_chat_id}_{tool_call_counter}_{uuid.uuid4().hex[:8]}"
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
                                                "grade_progress",
                                                {
                                                    "sid": sid,
                                                    "type": "tool_call_start",
                                                    "chat_id": str(simulation_chat_id),
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
                                # Try to get tool name from existing tool call if available
                                tool_name_from_dict = None
                                for tc_id, tc_state in tool_calls_dict.items():
                                    if (
                                        tc_state.get("call_id") == call_id
                                        or tc_state.get("fake_id") == fake_item_id
                                    ):
                                        tool_name_from_dict = tc_state.get("name")
                                        break

                                tool_calls_dict[tool_call_id] = {
                                    "name": tool_name_from_dict,
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
                                    "grade_progress",
                                    {
                                        "sid": sid,
                                        "type": "tool_call_progress",
                                        "chat_id": str(simulation_chat_id),
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
                                    "grade_complete",
                                    {
                                        "sid": sid,
                                        "type": "tool_call_complete",
                                        "chat_id": str(simulation_chat_id),
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

                                # Mark tool as completed in grading_progress
                                if tool_name:
                                    grading_progress[tool_name] = True

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
                from app.infra.v4.websocket.remove_active_run import \
                    remove_active_run

                await remove_active_run(str(simulation_chat_id))

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            # Pattern: All AI operations must emit log_run event after completion
            # See WEBSOCKET_STANDARDS.md for details
            usage = result_runner.context_wrapper.usage
            assistant_output = getattr(result_runner, "final_output", None) or ""
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
                    "run_id": str(model_run_id),
                    "operation_type": "simulation_grade",
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": agent.get("system_prompt"),
                    "input_items": input_items_with_dev,  # Serialized TResponseInputItem list
                    "assistant_output": assistant_output,
                    "department_id": str(department_id) if department_id else None,
                },
            )

            # Emit run completion event (dispatched by complete.py)
            await internal_sio.emit(
                "grade_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "chat_id": str(simulation_chat_id),
                    "run_id": str(model_run_id),
                },
            )
            # Calculate overall score from feedbacks in database
            from app.sql.types import GetFeedbackTotalsForGradeSqlParams

            SQL_GET_FEEDBACKS_PATH = (
                "app/sql/v4/grading/get_feedback_totals_for_grade_complete.sql"
            )
            feedback_params = GetFeedbackTotalsForGradeSqlParams(grade_id=grade_id)
            feedback_rows = await execute_sql_typed(
                conn, SQL_GET_FEEDBACKS_PATH, params=feedback_params
            )
            if isinstance(feedback_rows, list):
                overall_score = sum(row.total for row in feedback_rows)
            else:
                overall_score = feedback_rows.total if feedback_rows else 0

            passed = overall_score >= rubric["pass_points"]

            # Get description from final output (no summary tool anymore)
            summary = getattr(result_runner, "final_output", None) or ""

            # Update grade record with final values
            from app.sql.types import UpdateGradeFinalSqlParams

            SQL_UPDATE_GRADE_PATH = "app/sql/v4/grading/update_grade_final_complete.sql"
            update_grade_params = UpdateGradeFinalSqlParams(
                grade_id=grade_id,
                description=summary,
                passed=passed,
                score=overall_score,
            )
            await execute_sql_typed(
                conn, SQL_UPDATE_GRADE_PATH, params=update_grade_params
            )

            # 3. Mark chat as completed
            from app.sql.types import MarkChatCompletedSqlParams

            SQL_MARK_COMPLETED_PATH = (
                "app/sql/v4/simulations/mark_chat_completed_complete.sql"
            )
            mark_completed_params = MarkChatCompletedSqlParams(
                chat_id=simulation_chat_id
            )
            await execute_sql_typed(
                conn, SQL_MARK_COMPLETED_PATH, params=mark_completed_params
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
    except RuntimeError:
        error_message = "Database connection pool not available"
        await simulation_grading_progress(
            SimulationGradingProgressPayload(
                type="error",
                chat_id=chat_id,
                message=error_message,
                error=error_message,
            ),
            room=f"simulation_{chat_id}",
        )
        # Also emit via error handler with simulation context if available
        attempt_id: str | None = None
        simulation_id: str | None = None
        try:
            async with get_db_connection() as conn:
                sql = load_sql("app/sql/v4/simulations/get_simulation_run_context.sql")
                context_result = await conn.fetchrow(sql, uuid.UUID(chat_id))
                if context_result:
                    attempt_id = (
                        str(context_result.get("attempt_id"))
                        if context_result.get("attempt_id")
                        else None
                    )
                    simulation_id = (
                        str(context_result.get("simulation_id"))
                        if context_result.get("simulation_id")
                        else None
                    )
        except Exception:
            pass  # Ignore errors when fetching context
        if attempt_id or simulation_id:
            await internal_sio.emit(
                "grade_text_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": error_message,
                    "attempt_id": attempt_id,
                    "simulation_id": simulation_id,
                    "operation": "grading",
                },
            )
    except Exception as e:
        error_message = f"Grading failed: {str(e)}"
        # Emit error event
        try:
            await simulation_grading_progress(
                SimulationGradingProgressPayload(
                    type="error",
                    chat_id=chat_id,
                    message=error_message,
                    error=str(e),
                ),
                room=f"simulation_{chat_id}",
            )
        except Exception:
            # Error emitting error event - Socket.IO handles logging
            pass
        # Also emit via error handler with simulation context if available
        attempt_id: str | None = None
        simulation_id: str | None = None
        try:
            async with get_db_connection() as conn:
                sql = load_sql("app/sql/v4/simulations/get_simulation_run_context.sql")
                context_result = await conn.fetchrow(sql, uuid.UUID(chat_id))
                if context_result:
                    attempt_id = (
                        str(context_result.get("attempt_id"))
                        if context_result.get("attempt_id")
                        else None
                    )
                    simulation_id = (
                        str(context_result.get("simulation_id"))
                        if context_result.get("simulation_id")
                        else None
                    )
        except Exception:
            pass  # Ignore errors when fetching context
        if attempt_id or simulation_id:
            await internal_sio.emit(
                "grade_text_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": error_message,
                    "attempt_id": attempt_id,
                    "simulation_id": simulation_id,
                    "operation": "grading",
                },
            )


@sio.event  # type: ignore
async def simulation_grading_start(sid: str, data: dict[str, Any]) -> None:
    """Handle grading start event from client (client-to-server)."""
    # Get profile_id from sid lookup
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        await simulation_grading_progress(
            SimulationGradingProgressPayload(
                type="error",
                chat_id=data.get("chat_id", "unknown"),
                message="Profile not found for socket",
                error="Profile not found for socket",
            ),
            room=f"simulation_{data.get('chat_id', 'unknown')}",
        )
        return

    profile_id = uuid.UUID(profile_id_str)

    # Validate payload
    try:
        validated = SimulationGradingStartPayload(**data)
    except ValidationError as e:
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

    await _simulation_grading_start_impl(sid, validated, profile_id)


@internal_sio.on("simulation_grading_start")
async def simulation_grading_start_internal(data: dict[str, Any]) -> None:
    """Handle grading start event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        # Missing sid - Socket.IO handles logging
        return
    # Get profile_id from sid lookup
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        # Profile not found - emit error
        await simulation_grading_progress(
            SimulationGradingProgressPayload(
                type="error",
                chat_id=data.get("chat_id", "unknown"),
                message="Profile not found for socket",
                error="Profile not found for socket",
            ),
            room=f"simulation_{data.get('chat_id', 'unknown')}",
        )
        return
    profile_id = uuid.UUID(profile_id_str)
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    try:
        validated = SimulationGradingStartPayload(**payload)
    except ValidationError as e:
        await simulation_grading_progress(
            SimulationGradingProgressPayload(
                type="error",
                chat_id=payload.get("chat_id", "unknown"),
                message=f"Invalid payload: {str(e)}",
                error=str(e),
            ),
            room=f"simulation_{payload.get('chat_id', 'unknown')}",
        )
        return
    await _simulation_grading_start_impl(sid, validated, profile_id)


# FastAPI endpoint for OpenAPI documentation
register_client_endpoint(
    client_router,
    "/start",
    SimulationGradingStartPayload,
    "Start grading for a simulation chat",
)

register_client_endpoint(
    server_router,
    "/progress",
    SimulationGradingProgressPayload,
    "Simulation grading progress update",
)
