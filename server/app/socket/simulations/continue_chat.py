"""Handler for continue_simulation WebSocket event."""

import json
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

import asyncpg  # type: ignore
from agents import (FunctionToolResult, RunContextWrapper, Runner,
                    ToolsToFinalOutputResult, trace)
from agents.items import TResponseInputItem
from app.main import get_pool, get_grading_storage, sio
from app.utils.storage.request_storage import build_storage_key
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_grading_tools import create_grading_tools
from app.utils.agents.tools.create_safe_field_name import \
    create_safe_field_name
from app.utils.chat.format_chat_scenario import format_chat_scenario
from app.utils.chat.get_simulation_conversation_history import \
    get_simulation_conversation_history
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.logging.db_logger import get_logger
from app.utils.messages.log_run_messages import log_run_messages
from app.utils.rubric import get_dynamic_rubric
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class ContinueSimulationErrorPayload(BaseModel):
    success: bool
    message: str


class SimulationGradingProgressPayload(BaseModel):
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


class EndAllStartedPayload(BaseModel):
    chat_id: str
    attempt_id: str


class EndChatStartedPayload(BaseModel):
    chat_id: str
    attempt_id: str


class EndAllCompletedPayload(BaseModel):
    success: bool
    message: str
    chat_id: str
    attempt_id: str | None = None
    completed_chat_ids: list[str] | None = None
    next_chat_ids: list[str | None] | None = None
    all_completed: bool | None = None


class SimulationContinuedPayload(BaseModel):
    success: bool
    message: str
    completed_chat_id: str
    next_chat_id: str | None
    is_attempt_finished: bool | None = None
    simulation_grade_id: str | None = None


# Pydantic model for client-to-server event
class ContinueSimulationPayload(BaseModel):
    chat_id: str
    attempt_id: str
    end_all: bool = False
    previous_chat_id: str | None = None
    previous_chat_map: dict[str, str | None] | None = None


# Emit helper functions
async def continue_simulation_error(
    payload: ContinueSimulationErrorPayload, room: str
) -> None:
    await sio.emit("continue_simulation_error", payload.model_dump(), room=room)


async def simulation_grading_progress(
    payload: SimulationGradingProgressPayload, room: str
) -> None:
    await sio.emit(
        "simulation_grading_progress", payload.model_dump(exclude_none=True), room=room
    )


async def end_all_started(payload: EndAllStartedPayload, room: str) -> None:
    await sio.emit("end_all_started", payload.model_dump(), room=room)


async def end_chat_started(payload: EndChatStartedPayload, room: str) -> None:
    await sio.emit("end_chat_started", payload.model_dump(), room=room)


async def end_all_completed(payload: EndAllCompletedPayload, room: str) -> None:
    await sio.emit("end_all_completed", payload.model_dump(), room=room)


async def simulation_continued(payload: SimulationContinuedPayload, room: str) -> None:
    await sio.emit("simulation_continued", payload.model_dump(), room=room)


async def _create_chat_for_scenario_inline(
    conn: asyncpg.Connection,
    scenario_id: str,
    attempt_id: str,
    profile_id: str | None,
    mark_completed: bool,
) -> dict[str, str] | None:
    """Create chat for a scenario with full scenario preparation.

    Helper function for continue_simulation_attempt.
    Uses SQL files for database operations.
    Inlined from simulations/utils.py to remove abstraction layer.
    """
    from agents import gen_trace_id

    # Get parent scenario by ID (NEVER modify the original scenario)
    sql = load_sql("sql/v3/scenarios/get_scenario_by_id.sql")
    parent_scenario = await conn.fetchrow(sql, scenario_id)
    if not parent_scenario:
        return None

    # Use randomization function to select attributes and create child scenario
    from app.api.v3.scenarios.randomize import randomize_scenario_attributes

    # Convert asyncpg UUID to Python UUID
    parent_scenario_id_uuid = uuid.UUID(str(parent_scenario["id"]))
    profile_id_uuid = uuid.UUID(str(profile_id)) if profile_id else None

    # Get department_ids from scenario_departments junction table (for better department selection)
    sql = load_sql("sql/v3/scenarios/get_scenario_departments.sql")
    scenario_dept_rows = await conn.fetch(sql, parent_scenario_id_uuid)
    scenario_dept_ids = [uuid.UUID(str(row["department_id"])) for row in scenario_dept_rows] if scenario_dept_rows else None

    # Call randomization function which handles attribute selection and child creation
    randomized_result = await randomize_scenario_attributes(
        conn=conn,
        persona_ids=None,
        document_ids=None,
        parameter_item_ids=None,
        department_ids=scenario_dept_ids,  # Use scenario's departments if available
        scenario_id=parent_scenario_id_uuid,
        profile_id=profile_id_uuid,
        targets=None,  # Randomize all
    )

    new_scenario_id = randomized_result["child_scenario_id"]
    if not new_scenario_id:
        raise ValueError("Failed to create child scenario")

    logger.info(
        f"Created child scenario variant {new_scenario_id} for parent {parent_scenario_id_uuid} "
        f"with persona_id={randomized_result['persona_id']}, "
        f"document_ids={randomized_result['document_ids']}, "
        f"parameter_item_ids={randomized_result['parameter_item_ids']}"
    )

    # Step 15: Create chat using child scenario ID (not parent)
    chat_title = parent_scenario.get("name", "")
    trace_id = gen_trace_id()

    sql = load_sql("sql/v3/simulations/create_simulation_chat.sql")
    chat = await conn.fetchrow(
        sql,
        datetime.now(UTC),
        chat_title,
        str(new_scenario_id),  # Use child scenario ID, not parent
        attempt_id,
        mark_completed,
        trace_id,
    )

    return dict(chat) if chat else None


async def _run_grade_agent_inline(
    simulation_chat_id: uuid.UUID,
    department_id: uuid.UUID,
    conn: asyncpg.Connection,
) -> str:
    """Inlined grading agent logic."""
    try:
        # Clear previous results
        grading_results.clear()
        grading_progress.clear()

        # Get all grading context data in one optimized query using SQL file
        sql = load_sql("sql/v3/agents/get_grading_run_context.sql")
        context_row = await conn.fetchrow(
            sql, str(simulation_chat_id), str(department_id)
        )

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
        conversation_history = get_simulation_conversation_history(messages)

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

        # Build dynamic rubric using utility function
        rubric_input = get_dynamic_rubric(rubric, standard_groups, standards)

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
        context["completed"]

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
        input_items.insert(0, rubric_input)

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
        grading_tools.append(debug_info_tool)
        logger.info(
            f"Created {len(grading_tools)} grading tools (including debug_info)"
        )

        # Create tool use behavior to check when all required tools are called
        def tool_use_behavior(
            tool_context: RunContextWrapper[Any],
            tool_results: list[FunctionToolResult],
        ) -> ToolsToFinalOutputResult:
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
            model_provider=provider["name"],
            base_url=provider["base_url"],
            api_key=provider["api_key"],
            reasoning=agent["reasoning"],
            tools=grading_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
            custom_model=model["custom_model"],
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
        
        # Log system and developer messages for this run
        rubric_dev_content = rubric_input["content"]
        time_dev_content = time_message["content"]
        await log_run_messages(
            conn=conn,
            run_id=model_run_id,
            system_prompt=agent["system_prompt"],
            developer_message_contents=[rubric_dev_content, time_dev_content],
            department_id=department_id,
        )

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
        
        # Log assistant message (model output)
        assistant_output = getattr(result, "final_output", None) or ""
        if assistant_output:
            await log_run_messages(
                conn=conn,
                run_id=model_run_id,
                system_prompt=None,  # Already logged
                assistant_output=assistant_output,
                department_id=department_id,
            )

        usage = result.context_wrapper.usage

        # Update model run with token usage using SQL file
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
        await conn.execute(
            sql_update_tokens,
            str(model_run_id),
            usage.input_tokens,
            usage.output_tokens,
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
        logger.info(f"Emitted grading completion event for chat {simulation_chat_id}")

        logger.info(f"Grading completed successfully with grade ID: {grade_id}")

        return str(grade_id)

    except Exception as e:
        logger.error(f"Error in grading agent: {str(e)}", exc_info=True)

        # Emit error event
        try:
            await simulation_grading_progress(
                SimulationGradingProgressPayload(
                    type="error",
                    chat_id=str(simulation_chat_id),
                    message=f"Grading failed: {str(e)}",
                    error=str(e),
                ),
                room=f"simulation_{simulation_chat_id}",
            )
        except Exception as emit_err:
            logger.warning(f"Failed to emit error event: {emit_err}")

        raise


async def _continue_simulation_impl(sid: str, data: ContinueSimulationPayload) -> None:
    """
    Handle simulation continue requests via WebSocket
    Replaces /simulations/continue endpoint
    Inlined from SimulationService.continue_simulation_attempt to use SQL files
    """
    try:
        chat_id = data.chat_id
        attempt_id = data.attempt_id
        end_all = data.end_all
        previous_chat_id = data.previous_chat_id
        previous_chat_map = data.previous_chat_map
        # department_id is now derived server-side from chat/scenario context

        if not chat_id or not attempt_id:
            await continue_simulation_error(
                ContinueSimulationErrorPayload(
                    success=False, message="Missing chat_id or attempt_id"
                ),
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: Missing chat_id or attempt_id")
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            await continue_simulation_error(
                ContinueSimulationErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Get the chat
            sql = load_sql("sql/v3/simulations/get_chat_basic.sql")
            chat = await conn.fetchrow(sql, chat_id)
            if not chat:
                await continue_simulation_error(
                    ContinueSimulationErrorPayload(
                        success=False, message="Chat not found"
                    ),
                    room=sid,
                )
                logger.error(f"Emitted error to {sid}: Chat not found")
                return

            # Get the attempt with profile
            sql = load_sql("sql/v3/attempts/get_attempt_with_profile.sql")
            attempt_with_profile = await conn.fetchrow(sql, attempt_id)
            if not attempt_with_profile:
                await continue_simulation_error(
                    ContinueSimulationErrorPayload(
                        success=False, message="Attempt not found"
                    ),
                    room=sid,
                )
                logger.error(f"Emitted error to {sid}: Attempt not found")
                return

            # If end_all is True, emit end_all_started event immediately so all watchers see the loading state
            if end_all:
                await end_all_started(
                    EndAllStartedPayload(chat_id=chat_id, attempt_id=attempt_id),
                    room=f"simulation_{chat_id}",
                )
                logger.info(f"Emitted end_all_started for chat {chat_id}, attempt {attempt_id}")
            else:
                # If end_all is False, emit end_chat_started event immediately so all watchers see the loading state
                await end_chat_started(
                    EndChatStartedPayload(chat_id=chat_id, attempt_id=attempt_id),
                    room=f"simulation_{chat_id}",
                )
                logger.info(f"Emitted end_chat_started for chat {chat_id}, attempt {attempt_id}")

            simulation_attempt = attempt_with_profile
            profile_id = attempt_with_profile.get("profile_id")

            # Extract department_id from chat/scenario for grading
            # SQL query includes fallback: scenario -> profile -> any active department
            sql = load_sql("sql/v3/agents/get_simulation_run_context.sql")
            run_context = await conn.fetchrow(sql, chat_id)

            if not run_context:
                await continue_simulation_error(
                    ContinueSimulationErrorPayload(
                        success=False,
                        message="Failed to get run context for chat",
                    ),
                    room=sid,
                )
                logger.error(f"Emitted error to {sid}: Failed to get run context for chat {chat_id}")
                return

            # department_id should always be present due to SQL fallback logic
            # but handle edge case where no departments exist in system
            department_id = run_context.get("department_id")
            if not department_id:
                await continue_simulation_error(
                    ContinueSimulationErrorPayload(
                        success=False,
                        message="No active departments found in system",
                    ),
                    room=sid,
                )
                logger.error(
                    f"Emitted error to {sid}: No active departments found in system for chat {chat_id}"
                )
                return

            department_id = uuid.UUID(str(department_id))

            # Get the simulation
            sql = load_sql("sql/v3/simulations/get_simulation_by_id.sql")
            simulation = await conn.fetchrow(
                sql, str(simulation_attempt["simulation_id"])
            )
            if not simulation:
                await continue_simulation_error(
                    ContinueSimulationErrorPayload(
                        success=False, message="Simulation not found"
                    ),
                    room=sid,
                )
                logger.error(f"Emitted error to {sid}: Simulation not found")
                return

            # Practice simulations cannot use previous chats - must always go through manual grading
            is_practice_simulation = bool(simulation.get("practice_simulation", False))
            if is_practice_simulation and (previous_chat_id or previous_chat_map):
                await continue_simulation_error(
                    ContinueSimulationErrorPayload(
                        success=False,
                        message="Practice simulations cannot reuse previous attempts. Manual grading is required.",
                    ),
                    room=sid,
                )
                logger.warning(
                    f"Emitted error to {sid}: Attempted to reuse previous chat for practice simulation"
                )
                return

            # Load scenarios for this simulation from junction table
            sql = load_sql("sql/v3/simulations/get_simulation_scenarios_ordered.sql")
            scenario_links = await conn.fetch(sql, str(simulation["id"]))
            is_infinite_mode = bool(simulation_attempt["infinite_mode"])

            # Get existing chats for this attempt
            sql = load_sql("sql/v3/attempts/get_existing_chats_for_attempt.sql")
            existing_chats = await conn.fetch(sql, attempt_id)

            # Debug: Check if existing_chats have 'id' field
            if existing_chats and "id" not in existing_chats[0]:
                await continue_simulation_error(
                    ContinueSimulationErrorPayload(
                        success=False,
                        message=f"Existing chats missing 'id' field: {existing_chats[0]}",
                    ),
                    room=sid,
                )
                logger.error(
                    f"Emitted error to {sid}: Existing chats missing 'id' field: {existing_chats[0]}"
                )
                return

            # Get parent scenarios from simulation_scenarios that have at least one graded chat
            # A scenario is considered "done" if it has a chat (linked via attempt_chats) with a grade
            # This uses simulation_scenarios as the source of truth
            sql = load_sql("sql/v3/simulations/get_scenarios_with_grades.sql")
            scenarios_with_grades = await conn.fetch(sql, attempt_id)
            scenarios_with_grades_set = {
                str(row["parent_scenario_id"]) for row in scenarios_with_grades
            }

            # Get current chat's scenario_id to exclude it from next scenario selection
            # (for normal grading, we don't want to create another chat for the current scenario)
            # Recursively map child scenario ID to root parent ID for comparison with scenario_links (which contain parent IDs)
            current_chat_child_scenario_id = str(chat.get("scenario_id"))
            sql = load_sql("sql/v3/scenarios/get_root_scenario_id.sql")
            current_chat_parent_row = await conn.fetchrow(sql, current_chat_child_scenario_id)
            current_chat_scenario_id = (
                str(current_chat_parent_row["root_scenario_id"])
                if current_chat_parent_row and current_chat_parent_row.get("root_scenario_id")
                else current_chat_child_scenario_id
            )

            # Also get scenarios that already have chats (even without grades) to avoid duplicates
            # This prevents creating multiple chats for the same scenario in the same attempt
            # Recursively map child scenario IDs to root parent IDs for comparison with scenario_links (which contain parent IDs)
            existing_scenario_ids = set()
            if existing_chats:
                child_scenario_ids = [
                    str(ec.get("scenario_id"))
                    for ec in existing_chats
                    if ec.get("scenario_id")
                ]
                if child_scenario_ids:
                    # Batch query to recursively map all child IDs to root parent IDs
                    sql = load_sql("sql/v3/scenarios/get_root_scenario_id.sql")
                    parent_mappings = []
                    for child_id in child_scenario_ids:
                        root_row = await conn.fetchrow(sql, child_id)
                        if root_row and root_row.get("root_scenario_id"):
                            parent_mappings.append({
                                "child_id": child_id,
                                "parent_id": str(root_row["root_scenario_id"])
                            })
                    # Filter to only include parents that are actually in scenario_links
                    # This prevents excluding scenarios from other simulations/scenarios
                    scenario_links_parent_ids = {
                        str(sl["scenario_id"]) for sl in scenario_links
                    }
                    existing_scenario_ids = {
                        row["parent_id"]
                        for row in parent_mappings
                        if row["parent_id"] in scenario_links_parent_ids
                    }

            # Find the next scenario index that doesn't have a graded chat
            # Exclude the current chat's scenario (it will be graded but doesn't have a grade yet)
            # Also exclude scenarios that already have chats (to prevent duplicates)
            next_index = None
            for idx, scenario_link in enumerate(scenario_links):
                scenario_id_str = str(scenario_link["scenario_id"])
                # Skip scenarios that:
                # 1. Already have grades (completed with grade)
                # 2. Are the current chat's scenario (will be graded)
                # 3. Already have a chat in this attempt (prevent duplicates)
                if (
                    scenario_id_str not in scenarios_with_grades_set
                    and scenario_id_str != current_chat_scenario_id
                    and scenario_id_str not in existing_scenario_ids
                ):
                    next_index = idx
                    break

            # If all scenarios have graded chats or only current scenario remains, use the length for infinite mode cycling
            if next_index is None:
                next_index = len(scenario_links)

            # Handle previous_chat_id if provided (reusing score from previous attempt)
            if previous_chat_id:
                # Link the previous chat to current attempt via junction table
                sql = load_sql("sql/v3/attempts/link_chat_to_attempt.sql")
                await conn.execute(sql, attempt_id, previous_chat_id)

                # Check if the previous chat has a grade and update scenarios_with_grades_set
                sql = load_sql("sql/v3/simulations/get_previous_chat_info.sql")
                prev_chat_info = await conn.fetchrow(sql, previous_chat_id)
                if (
                    prev_chat_info
                    and prev_chat_info["has_grade"]
                    and prev_chat_info["scenario_id"]
                ):
                    # Recursively map child scenario ID to root parent ID for comparison with scenario_links
                    prev_chat_child_scenario_id = str(prev_chat_info["scenario_id"])
                    sql = load_sql("sql/v3/scenarios/get_root_scenario_id.sql")
                    prev_chat_parent_row = await conn.fetchrow(sql, prev_chat_child_scenario_id)
                    prev_chat_parent_scenario_id = (
                        str(prev_chat_parent_row["root_scenario_id"])
                        if prev_chat_parent_row and prev_chat_parent_row.get("root_scenario_id")
                        else prev_chat_child_scenario_id
                    )
                    scenarios_with_grades_set.add(prev_chat_parent_scenario_id)
                    # Recalculate next_index since we now have a new scenario with a grade
                    # Also need to check against existing_scenario_ids
                    next_index = None
                    for idx, scenario_link in enumerate(scenario_links):
                        scenario_id_str = str(scenario_link["scenario_id"])
                        if (
                            scenario_id_str not in scenarios_with_grades_set
                            and scenario_id_str != current_chat_scenario_id
                            and scenario_id_str not in existing_scenario_ids
                        ):
                            next_index = idx
                            break
                    if next_index is None:
                        next_index = len(scenario_links)

                # Mark current incomplete chat as completed (without grade = skipped)
                sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                await conn.execute(sql, chat_id)

                # If end_all, mark all remaining incomplete chats as completed
                if end_all:
                    for existing_chat in existing_chats:
                        if (
                            not existing_chat["completed"]
                            and str(existing_chat["id"]) != str(chat_id)
                        ):
                            sql = load_sql(
                                "sql/v3/simulations/update_chat_completed.sql"
                            )
                            await conn.execute(sql, str(existing_chat["id"]))

            # Handle previous_chat_map if provided (for end_all with permutations)
            created_chats_count_map = 0
            if end_all and previous_chat_map:
                # Mark current chat as completed (without grading - user is using previous chat scores)
                sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                await conn.execute(sql, chat_id)

                # Get scenario IDs that already have chats in this attempt
                # Recursively map child scenario IDs to root parent IDs for comparison with scenario_links (which contain parent IDs)
                existing_scenario_ids = set()
                if existing_chats:
                    child_scenario_ids = [
                        str(ec.get("scenario_id"))
                        for ec in existing_chats
                        if ec.get("scenario_id")
                    ]
                    if child_scenario_ids:
                        # Batch query to recursively map all child IDs to root parent IDs
                        sql = load_sql("sql/v3/scenarios/get_root_scenario_id.sql")
                        parent_mappings = []
                        for child_id in child_scenario_ids:
                            root_row = await conn.fetchrow(sql, child_id)
                            if root_row and root_row.get("root_scenario_id"):
                                parent_mappings.append({
                                    "child_id": child_id,
                                    "parent_id": str(root_row["root_scenario_id"])
                                })
                        # Filter to only include parents that are actually in scenario_links
                        # This prevents excluding scenarios from other simulations/scenarios
                        scenario_links_parent_ids = {
                            str(sl["scenario_id"]) for sl in scenario_links
                        }
                        existing_scenario_ids = {
                            row["parent_id"]
                            for row in parent_mappings
                            if row["parent_id"] in scenario_links_parent_ids
                        }

                # Process ALL scenarios in the simulation
                # For each scenario in previous_chat_map: link previous chat if provided
                # For scenarios NOT in previous_chat_map: create skipped chat if they don't have a chat yet
                for scenario_link in scenario_links:
                    scenario_id_str = str(scenario_link["scenario_id"])

                    if scenario_id_str in previous_chat_map:
                        # User selected a previous chat to reuse for this scenario
                        prev_chat_id = previous_chat_map[scenario_id_str]
                        if prev_chat_id:
                            # Link the previous chat to current attempt via junction table
                            sql = load_sql("sql/v3/attempts/link_chat_to_attempt.sql")
                            await conn.execute(sql, attempt_id, prev_chat_id)

                            # Check if the previous chat has a grade and update scenarios_with_grades_set
                            sql = load_sql(
                                "sql/v3/simulations/get_previous_chat_info.sql"
                            )
                            prev_chat_info = await conn.fetchrow(sql, prev_chat_id)
                            if (
                                prev_chat_info
                                and prev_chat_info["has_grade"]
                                and prev_chat_info["scenario_id"]
                            ):
                                # Recursively map child scenario ID to root parent ID for comparison with scenario_links
                                prev_chat_child_scenario_id = str(prev_chat_info["scenario_id"])
                                sql = load_sql("sql/v3/scenarios/get_root_scenario_id.sql")
                                prev_chat_parent_row = await conn.fetchrow(sql, prev_chat_child_scenario_id)
                                prev_chat_parent_scenario_id = (
                                    str(prev_chat_parent_row["root_scenario_id"])
                                    if prev_chat_parent_row and prev_chat_parent_row.get("root_scenario_id")
                                    else prev_chat_child_scenario_id
                                )
                                scenarios_with_grades_set.add(prev_chat_parent_scenario_id)
                    elif scenario_id_str not in existing_scenario_ids:
                        # Scenario not in map and doesn't have a chat yet = skipped, create new completed chat (no grade)
                        created = await _create_chat_for_scenario_inline(
                            conn,
                            scenario_id_str,
                            attempt_id,
                            profile_id,
                            mark_completed=True,
                        )
                        if created is None:
                            # Scenario not found, skip it
                            continue
                        created_chats_count_map += 1
            elif end_all and not previous_chat_map and not previous_chat_id:
                # If end_all but no previous_chat_map or previous_chat_id, mark all remaining incomplete chats as completed (skipped)
                for existing_chat in existing_chats:
                    if not existing_chat["completed"]:
                        sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                        await conn.execute(sql, str(existing_chat["id"]))

            # Create next chat if not end_all (works for both previous_chat_id and normal cases)
            next_chat_id: str | None = None
            if not end_all and scenario_links:
                next_scenario_id = None
                if is_infinite_mode:
                    # Cycle through the configured scenarios indefinitely in order (1,2,3,1,2,3...)
                    # Compute last used scenario index to continue from where we left off
                    num_scenarios = len(scenario_links)
                    last_used_index = 0  # Default to start from beginning
                    
                    if num_scenarios > 0 and existing_chats:
                        # Get the most recent chat's scenario
                        # Query for the most recent chat with created_at to get accurate ordering
                        sql = """
                            SELECT sc.scenario_id, sc.created_at
                            FROM attempt_chats ac
                            JOIN simulation_chats sc ON sc.id = ac.chat_id
                            WHERE ac.attempt_id = $1::uuid
                            ORDER BY sc.created_at DESC
                            LIMIT 1
                        """
                        most_recent_row = await conn.fetchrow(sql, attempt_id)
                        if most_recent_row:
                            most_recent_child_scenario_id = str(most_recent_row["scenario_id"])
                        else:
                            most_recent_child_scenario_id = ""
                        
                        if most_recent_child_scenario_id:
                            # Recursively map child scenario ID to root parent scenario ID
                            sql = load_sql("sql/v3/scenarios/get_root_scenario_id.sql")
                            parent_row = await conn.fetchrow(sql, most_recent_child_scenario_id)
                            most_recent_parent_id = (
                                str(parent_row["root_scenario_id"]) 
                                if parent_row and parent_row.get("root_scenario_id")
                                else most_recent_child_scenario_id
                            )
                            
                            # Find the index of this parent scenario in scenario_links
                            for idx, scenario_link in enumerate(scenario_links):
                                if str(scenario_link["scenario_id"]) == most_recent_parent_id:
                                    last_used_index = idx
                                    break
                    
                    # Start cycling from the next scenario after the last used one
                    # In infinite mode, allow cycling back to the same scenario (especially important for single-scenario simulations)
                    start_index = (last_used_index + 1) % num_scenarios
                    
                    # Cycle through scenarios starting from start_index
                    # In infinite mode, we allow repeating scenarios, so no exclusion check needed
                    for offset in range(num_scenarios):
                        cycling_index = (start_index + offset) % num_scenarios
                        next_scenario_id = scenario_links[cycling_index]["scenario_id"]
                        break
                elif next_index is not None and next_index < len(scenario_links):
                    # Use the next scenario that doesn't have a graded chat
                    # (next_index already excludes current_chat_scenario_id)
                    next_scenario_id = scenario_links[next_index]["scenario_id"]

                if next_scenario_id is not None:
                    # Double-check that this scenario is valid
                    scenario_id_str = str(next_scenario_id)
                    # For infinite mode, allow creating chats for any scenario (including the current one)
                    # This enables cycling through scenarios indefinitely, especially important for single-scenario simulations
                    # For normal mode, check grades and existing chats as well
                    should_create = False
                    if is_infinite_mode:
                        # In infinite mode, always allow creating the next chat (cycling logic already selected the appropriate scenario)
                        should_create = True
                    else:
                        # Double-check that this scenario doesn't already have a graded chat,
                        # is not the current chat's scenario, and doesn't already have a chat
                        # (it might have been created between the query and now)
                        should_create = (
                            scenario_id_str not in scenarios_with_grades_set
                            and scenario_id_str != current_chat_scenario_id
                            and scenario_id_str not in existing_scenario_ids
                        )
                    
                    if should_create:
                        created_next_chat = await _create_chat_for_scenario_inline(
                            conn,
                            scenario_id_str,
                            attempt_id,
                            profile_id,
                            mark_completed=False,
                        )
                        if created_next_chat is None:
                            await continue_simulation_error(
                                ContinueSimulationErrorPayload(
                                    success=False, message="Next scenario not found"
                                ),
                                room=sid,
                            )
                            logger.error(
                                f"Emitted error to {sid}: Next scenario not found"
                            )
                            return
                        if "id" not in created_next_chat:
                            await continue_simulation_error(
                                ContinueSimulationErrorPayload(
                                    success=False,
                                    message=f"Created chat missing 'id' field: {created_next_chat}",
                                ),
                                room=sid,
                            )
                            logger.error(
                                f"Emitted error to {sid}: Created chat missing 'id' field: {created_next_chat}"
                            )
                            return
                        next_chat_id = created_next_chat["id"]

            # Grade the just-completed chat if it has at least 2 messages
            # Skip grading if using previous_chat_id or previous_chat_map (user is reusing previous scores)
            simulation_grade_id = None
            if not previous_chat_id and not previous_chat_map:
                # Use optimized batch query to get message counts
                existing_chat_ids = [str(c["id"]) for c in existing_chats]
                sql = load_sql("sql/v3/simulations/get_messages_count_by_chat_ids.sql")
                message_counts = await conn.fetch(sql, existing_chat_ids)
                message_count_map = {
                    str(row["chat_id"]): row["message_count"] for row in message_counts
                }

                chat_message_count = message_count_map.get(chat_id, 0)
                if chat_message_count >= 2:
                    simulation_grade_id = await _run_grade_agent_inline(
                        uuid.UUID(chat_id), department_id, conn
                    )

                    # After grading completes, add current chat's parent scenario to scenarios_with_grades_set
                    # and recalculate next_index (similar to previous_chat_id handling)
                    # This is mainly for tracking purposes - the next chat was already created correctly
                    # because we excluded current_chat_scenario_id and existing_scenario_ids when creating it
                    # Recursively map child scenario ID to root parent ID (scenarios_with_grades_set uses parent IDs from simulation_scenarios)
                    graded_chat_child_scenario_id = str(chat.get("scenario_id"))
                    if graded_chat_child_scenario_id:
                        # Recursively map to root parent ID from scenario_tree
                        sql = load_sql("sql/v3/scenarios/get_root_scenario_id.sql")
                        graded_chat_parent_row = await conn.fetchrow(sql, graded_chat_child_scenario_id)
                        graded_chat_parent_scenario_id = (
                            str(graded_chat_parent_row["root_scenario_id"])
                            if graded_chat_parent_row and graded_chat_parent_row.get("root_scenario_id")
                            else graded_chat_child_scenario_id
                        )
                        # Only add if this parent scenario is actually in simulation_scenarios
                        # (it should be, but verify to be safe)
                        if graded_chat_parent_scenario_id in {
                            str(sl["scenario_id"]) for sl in scenario_links
                        }:
                            scenarios_with_grades_set.add(graded_chat_parent_scenario_id)
                        # Recalculate next_index since we now have a new scenario with a grade
                        # This is for consistency and future operations, but shouldn't affect next_chat_id
                        # since it was already created with proper exclusions
                        next_index = None
                        for idx, scenario_link in enumerate(scenario_links):
                            scenario_id_str = str(scenario_link["scenario_id"])
                            if scenario_id_str not in scenarios_with_grades_set:
                                next_index = idx
                                break
                        if next_index is None:
                            next_index = len(scenario_links)

                # Mark the current chat as completed (if not already marked by previous_chat_map handling)
                if not (end_all and previous_chat_map):
                    sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                    await conn.execute(sql, chat_id)

            created_chats_count = 0
            # Only process remaining chats if not using previous_chat_map (already handled above)
            if end_all and not previous_chat_id and not previous_chat_map:
                # End any other incomplete chats for this attempt
                existing_chat_ids = [str(c["id"]) for c in existing_chats]
                sql = load_sql("sql/v3/simulations/get_messages_count_by_chat_ids.sql")
                message_counts = await conn.fetch(sql, existing_chat_ids)
                message_count_map = {
                    str(row["chat_id"]): row["message_count"] for row in message_counts
                }

                for existing_chat in existing_chats:
                    if (
                        not existing_chat["completed"]
                        and str(existing_chat["id"]) != str(chat_id)
                    ):
                        other_message_count = message_count_map.get(
                            str(existing_chat["id"]), 0
                        )
                        if other_message_count >= 2:
                            await _run_grade_agent_inline(
                                uuid.UUID(str(existing_chat["id"])),
                                department_id,
                                conn,
                            )
                        sql = load_sql("sql/v3/simulations/update_chat_completed.sql")
                        await conn.execute(sql, str(existing_chat["id"]))

                # Calculate and create remaining chats in order
                # Skip creating remaining chats in infinite mode - just stop here
                if not is_infinite_mode:
                    start_index = len(existing_chats)
                    total_needed = max(0, len(scenario_links) - start_index)

                    for offset in range(total_needed):
                        next_id = scenario_links[start_index + offset]["scenario_id"]
                        created = await _create_chat_for_scenario_inline(
                            conn, str(next_id), attempt_id, profile_id, mark_completed=True
                        )
                        if created is None:
                            break
                        created_chats_count += 1

            # Determine if attempt is finished: ALL parent scenarios from simulation_scenarios 
            # must have at least one graded chat (linked via attempt_chats)
            # This uses simulation_scenarios as the source of truth
            # For infinite mode, attempts never finish (they cycle indefinitely)
            if is_infinite_mode:
                is_attempt_finished = False
            else:
                sql = load_sql("sql/v3/simulations/get_scenarios_with_grades.sql")
                scenarios_with_grades_for_finished_check = await conn.fetch(sql, attempt_id)
                scenarios_with_grades_for_finished = {
                    str(row["parent_scenario_id"]) for row in scenarios_with_grades_for_finished_check
                }
                # Check if all parent scenarios from simulation_scenarios have graded chats
                all_parent_scenario_ids = {str(sl["scenario_id"]) for sl in scenario_links}
                is_attempt_finished = (
                    len(all_parent_scenario_ids) > 0 
                    and all_parent_scenario_ids.issubset(scenarios_with_grades_for_finished)
                )

            # Include chats created from previous_chat_map handling
            total_created_chats = created_chats_count + created_chats_count_map

            result = {
                "completed_chat_id": chat_id,
                "next_chat_id": next_chat_id,
                "is_attempt_finished": bool(is_attempt_finished),
                "simulation_grade_id": simulation_grade_id,
                "created_chats_count": total_created_chats,
            }

            if end_all:
                logger.info(
                    f"End all completed for attempt {attempt_id}: created {result['created_chats_count']} new chats"
                )

                # Get all chat IDs for this attempt to help frontend with cache invalidation
                sql = load_sql("sql/v3/attempts/get_existing_chats_for_attempt.sql")
                all_chats = await conn.fetch(sql, attempt_id)
                completed_chat_ids = [
                    str(c["id"]) for c in all_chats if c.get("completed")
                ]
                next_chat_ids: list[str | None] = [
                    str(c["id"]) for c in all_chats if not c.get("completed")
                ]

                # Emit end all completed event
                payload_obj = EndAllCompletedPayload(
                    success=True,
                    message="Ended all chats for this attempt",
                    chat_id=chat_id,
                    attempt_id=attempt_id,
                    completed_chat_ids=completed_chat_ids if completed_chat_ids else None,
                    next_chat_ids=next_chat_ids if next_chat_ids else None,
                    all_completed=True,
                )
                # Emit to requester
                await end_all_completed(payload_obj, room=sid)
                # Also broadcast to the simulation room so watchers stay in sync
                await end_all_completed(payload_obj, room=f"simulation_{chat_id}")
            else:
                # Emit the new, more descriptive success response for single chat
                continued_payload = SimulationContinuedPayload(
                    success=True,
                    message="Simulation continued successfully",
                    completed_chat_id=str(result["completed_chat_id"]),
                    next_chat_id=str(result["next_chat_id"]) if result["next_chat_id"] else None,
                    is_attempt_finished=bool(result["is_attempt_finished"]) if result["is_attempt_finished"] is not None else None,
                    simulation_grade_id=str(result["simulation_grade_id"]) if result["simulation_grade_id"] else None,
                )
                # Emit to requester
                await simulation_continued(continued_payload, room=sid)
                # Also broadcast to the simulation room so watchers stay in sync
                await simulation_continued(
                    continued_payload, room=f"simulation_{chat_id}"
                )

                logger.info(
                    f"Simulation continued successfully: completed_chat={result['completed_chat_id']}, next_chat={result['next_chat_id']}"
                )

    except Exception as e:
        logger.error(f"Error continuing simulation for {sid}: {str(e)}", exc_info=True)
        await continue_simulation_error(
            ContinueSimulationErrorPayload(
                success=False, message=f"Failed to continue simulation: {str(e)}"
            ),
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to continue simulation: {str(e)}")


@sio.event  # type: ignore
async def continue_simulation(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = ContinueSimulationPayload(**data)
        await _continue_simulation_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in continue_simulation for {sid}: {e}", exc_info=True)
        await continue_simulation_error(
            ContinueSimulationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
    except Exception as e:
        logger.error(f"Unexpected error in continue_simulation wrapper for {sid}: {str(e)}", exc_info=True)
        await continue_simulation_error(
            ContinueSimulationErrorPayload(
                success=False, message=f"Unexpected error: {str(e)}"
            ),
            room=sid,
        )
