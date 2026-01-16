"""Eval runner utility - evaluates a single run by calling eval_agent with messages from original run."""

import json
import uuid
from typing import Any, cast

import asyncpg  # type: ignore
from contextlib import contextmanager
from typing import Any

from app.infra.v4.agents.run_agent import run_agent_with_tools
from app.infra.v4.agents.types import TResponseInputItem
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.debug.debug_info import DebugContext
from app.main import get_internal_sio
from app.sql.types import (
    InfrastructureEvalsCreateTestSqlParams,
    InfrastructureEvalsCreateTestSqlRow,
    InfrastructureEvalsGetDepartmentFromRunSqlParams,
    InfrastructureEvalsGetDepartmentFromRunSqlRow,
    InfrastructureEvalsGetEvalRunStatusSqlParams,
    InfrastructureEvalsGetEvalRunStatusSqlRow,
    InfrastructureEvalsGetRubricDetailsSqlParams,
    InfrastructureEvalsGetRubricDetailsSqlRow,
    InfrastructureEvalsGetRubricGradeAgentSqlParams,
    InfrastructureEvalsGetRubricGradeAgentSqlRow,
    InfrastructureEvalsGetTestByTraceIdSqlParams,
    InfrastructureEvalsGetTestByTraceIdSqlRow,
    InfrastructureEvalsGetTestStatusSqlParams,
    InfrastructureEvalsGetTestStatusSqlRow,
    InfrastructureEvalsLinkAttemptTestSqlParams,
    InfrastructureEvalsLinkTestRunSqlParams,
    InfrastructureEvalsMarkEvalRunCompleteSqlParams,
    InfrastructureEvalsMarkTestCompleteSqlParams,
)

GET_RUBRIC_DETAILS_SQL_PATH = "app/sql/v4/infrastructure/evals/get_rubric_details_v4_complete.sql"

logger = get_logger(__name__)
internal_sio = get_internal_sio()


@contextmanager
def trace(name: str, trace_id: str | None = None, group_id: str | None = None):
    """No-op trace context manager (replaces agents.trace)."""
    # Log trace start for debugging
    logger.debug(f"Trace start: {name} (trace_id={trace_id}, group_id={group_id})")
    try:
        yield
    finally:
        logger.debug(f"Trace end: {name}")


async def run_eval_single_run(
    conn: asyncpg.Connection,
    eval_id: str,
    attempt_id: str,
    test_id: str | None,
    run_id: str,
    rubric_grade_agent_id: str,
    department_id: str | None,
    profile_id: str | None,
    dynamic: bool = False,
    agent_id: str | None = None,
    emit_progress_func: Any | None = None,
) -> dict[str, Any]:
    """
    Process a single run evaluation.

    Args:
        conn: Database connection
        eval_id: The eval ID
        attempt_id: The eval attempt ID
        test_id: The test ID (if already created, None to create new)
        run_id: The original run ID to evaluate
        rubric_grade_agent_id: The rubric_grade_agent ID (contains rubric and eval agent)
        department_id: Optional department ID
        profile_id: Optional profile ID
        dynamic: If true, re-run the agent being evaluated with modified system prompt
        agent_id: The agent being evaluated (required if dynamic is true)
        emit_progress_func: Optional function to emit WebSocket progress events

    Returns:
        dict with test_id, eval_run_id, grade_id, success status
    """
    try:
        # Idempotency check: If run is already completed, skip
        status_params = InfrastructureEvalsGetEvalRunStatusSqlParams(
            eval_id=uuid.UUID(eval_id),
            run_id=uuid.UUID(run_id),
        )
        status_result = cast(
            InfrastructureEvalsGetEvalRunStatusSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v4/infrastructure/evals/get_eval_run_status_v4_complete.sql",
                params=status_params,
            ),
        )
        completed_check = {"completed": status_result.completed if status_result else False}
        if completed_check and completed_check["completed"]:
            logger.info(
                f"Run {run_id} already completed for eval {eval_id}, skipping (idempotent)"
            )
            # Return existing test_id if available
            test_params = InfrastructureEvalsGetTestByTraceIdSqlParams(
                attempt_id=uuid.UUID(attempt_id),
                trace_id=f"eval_{attempt_id}_{run_id}",
            )
            test_result = cast(
                InfrastructureEvalsGetTestByTraceIdSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/infrastructure/evals/get_test_by_trace_id_v4_complete.sql",
                    params=test_params,
                ),
            )
            existing_test = {"test_id": test_result.test_id} if test_result else None
            return {
                "success": True,
                "test_id": existing_test["test_id"] if existing_test else None,
                "eval_run_id": None,  # Already exists
                "grade_id": None,  # Already exists
            }

        # Idempotency check: If test exists and is in progress, skip
        test_status_params = InfrastructureEvalsGetTestStatusSqlParams(
            attempt_id=uuid.UUID(attempt_id),
            trace_id=f"eval_{attempt_id}_{run_id}",
        )
        test_status_result = cast(
            InfrastructureEvalsGetTestStatusSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v4/infrastructure/evals/get_test_status_v4_complete.sql",
                params=test_status_params,
            ),
        )
        test_check = {
            "test_id": test_status_result.test_id,
            "completed": test_status_result.completed,
        } if test_status_result else None
        if test_check:
            logger.info(
                f"Run {run_id} already in progress (test {test_check['test_id']}), skipping (idempotent)"
            )
            return {
                "success": True,
                "test_id": test_check["test_id"],
                "eval_run_id": None,  # Already exists
                "grade_id": None,  # Will be created when completed
            }

        # Emit progress event
        if emit_progress_func:
            await emit_progress_func(
                {
                    "eval_id": eval_id,
                    "run_id": run_id,
                    "status": "running",
                    "message": f"Evaluating run {run_id[:8]}...",
                }
            )

        # 1. Get messages from original run
        sql_get_messages = load_sql("app/sql/v4/evals/get_run_messages_for_eval.sql")
        messages_row = await conn.fetchrow(sql_get_messages, run_id)
        if not messages_row:
            raise ValueError(f"No messages found for run {run_id}")

        messages_json = messages_row["messages"]
        if isinstance(messages_json, str):
            messages_json = json.loads(messages_json)

        # 2. Handle dynamic mode: if dynamic is true, re-run the agent being evaluated
        if dynamic:
            if not agent_id:
                raise ValueError("agent_id is required when dynamic is true")

            # Get agent being evaluated's context
            sql_get_agent_context = load_sql("app/sql/v4/evals/get_agent_context.sql")
            agent_context_row = await conn.fetchrow(
                sql_get_agent_context, agent_id, department_id, profile_id
            )
            if not agent_context_row:
                raise ValueError(f"Agent context not found for agent {agent_id}")

            agent_context = dict(agent_context_row)

            # Modify system prompt (placeholder - can be replaced via WebSocket)
            # For now, append a note that this is a dynamic evaluation
            modified_system_prompt = (
                agent_context["system_prompt"]
                + "\n\n[Note: This is a dynamic evaluation run with modified system prompt]"
            )

            # Get department_id from original run if not provided
            if not department_id:
                dept_params = InfrastructureEvalsGetDepartmentFromRunSqlParams(
                    run_id=uuid.UUID(run_id)
                )
                dept_result = cast(
                    InfrastructureEvalsGetDepartmentFromRunSqlRow,
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/infrastructure/evals/get_department_from_run_v4_complete.sql",
                        params=dept_params,
                    ),
                )
                if dept_result and dept_result.department_id:
                    department_id = dept_result.department_id

            # Create new run for agent being evaluated
            sql_create_agent_run = load_sql(
                "app/sql/v4/model_runs/create_model_run_complete.sql"
            )
            agent_run_row = await conn.fetchrow(
                sql_create_agent_run,
                department_id,
                agent_context["model_id"],
                agent_id,
                "agent",
                agent_context["profile_id"],
                None,  # key_id
                agent_id,  # agent_id
            )
            if not agent_run_row:
                raise ValueError("Failed to create agent run for dynamic eval")

            agent_run_id = agent_run_row["run_id"]

            # Prepare input items from original run (only user messages)
            agent_input_items: list[TResponseInputItem] = []
            for msg in messages_json:
                role = msg.get("role", "")
                content = msg.get("content", "")
                # Only include user messages for the agent being evaluated
                if role == "user":
                    agent_input_items.append({"role": "user", "content": str(content)})  # type: ignore[list-item]

            # Create GenericAgent with modified system prompt
            agent = GenericAgent(
                agent_name=agent_context["agent_name"],
                system_prompt=modified_system_prompt,
                temperature=agent_context["temperature"],
                model_name=agent_context["model_name"],
                provider=agent_context["provider"],
                api_key=agent_context["api_key"],
                base_url=agent_context["base_url"]
                if agent_context["base_url"]
                else None,
                reasoning=agent_context["reasoning"],
            )

            # Log system prompt and messages for agent run inline
            agent_run_id_uuid = uuid.UUID(agent_run_id)
            if modified_system_prompt:
                sql_link_sys_dev = load_sql(
                    "app/sql/v4/model_runs/link_system_developer_messages_to_run.sql"
                )
                await conn.fetchrow(
                    sql_link_sys_dev,
                    str(agent_run_id_uuid),
                    str(uuid.UUID(department_id)) if department_id else None,
                    None,  # chat_id
                )

            # Link developer messages from input_items if provided
            developer_contents: list[str] = []
            if agent_input_items:
                developer_messages = [
                    item
                    for item in agent_input_items
                    if item
                    and isinstance(item, dict)
                    and item.get("role") == "developer"
                ]
                for dev_msg in developer_messages:
                    content = dev_msg.get("content", "")
                    if isinstance(content, str):
                        stripped = content.strip()
                        if stripped:
                            developer_contents.append(stripped)

            # Link each developer message to the run
            sql_link_dev = load_sql(
                "app/sql/v4/simulations/link_developer_message_to_run.sql"
            )
            developer_message_ids: list[uuid.UUID] = []
            for content in developer_contents:
                result = await conn.fetchrow(
                    sql_link_dev,
                    content,
                    str(agent_run_id_uuid),
                )
                if result and result.get("message_id"):
                    message_id = result["message_id"]
                    if isinstance(message_id, uuid.UUID):
                        developer_message_ids.append(message_id)
                    else:
                        developer_message_ids.append(uuid.UUID(str(message_id)))

            # Run agent being evaluated with modified prompt
            logger.info(
                f"Running agent {agent_id} with modified prompt for dynamic eval (run {run_id})"
            )
            with trace(
                f"Dynamic Agent Run {run_id[:8]}",
                trace_id=f"dynamic_{attempt_id}_{run_id}",
                group_id=str(attempt_id),
            ):
                # Convert input items to message format
                messages = [
                    {"role": item.get("role", "user"), "content": item.get("content", "")}
                    for item in agent_input_items
                ]
                
                # Get model config from agent
                model_config = agent.get_model_config()
                
                # Run agent with tools
                agent_result = await run_agent_with_tools(
                    messages=messages,
                    tools=None,  # Dynamic eval agents don't use tools
                    tool_functions=agent.get_tool_functions(),
                    model=model_config["model"],
                    api_key=model_config["api_key"],
                    base_url=model_config.get("base_url"),
                    temperature=model_config["temperature"],
                    system_prompt=agent.get_system_prompt(),
                )

            # Save assistant output from agent run
            agent_usage = agent_result.context_wrapper.usage
            agent_assistant_output = getattr(agent_result, "final_output", None) or ""

            if agent_assistant_output and agent_assistant_output.strip():
                # Get the parent message ID (developer if exists, otherwise system)
                parent_message_id: uuid.UUID | None = None

                # Try to get developer message ID (use the last one if multiple)
                if developer_message_ids:
                    parent_message_id = developer_message_ids[-1]
                else:
                    # Get system message ID from the run
                    sys_dev_result = await conn.fetchrow(
                        load_sql(
                            "app/sql/v4/model_runs/link_system_developer_messages_to_run.sql"
                        ),
                        str(agent_run_id_uuid),
                        str(uuid.UUID(department_id)) if department_id else None,
                        None,  # chat_id
                    )
                    if sys_dev_result and sys_dev_result.get("system_message_id"):
                        system_msg_id = sys_dev_result["system_message_id"]
                        if isinstance(system_msg_id, uuid.UUID):
                            parent_message_id = system_msg_id
                        else:
                            parent_message_id = uuid.UUID(str(system_msg_id))

                # Create assistant message with branch
                sql_create_assistant = load_sql(
                    "app/sql/v4/messages/create_assistant_message_with_branch.sql"
                )
                await conn.fetchrow(
                    sql_create_assistant,
                    agent_assistant_output.strip(),
                    str(agent_run_id_uuid),
                    str(parent_message_id) if parent_message_id else None,
                )

            # Handle pricing/logs for agent run
            await internal_sio.emit(
                "log_run",
                {
                    "run_id": agent_run_id,
                    "operation_type": "eval",
                    "input_text_tokens": agent_usage.input_tokens,
                    "output_text_tokens": agent_usage.output_tokens,
                    "system_prompt": modified_system_prompt,
                    "input_items": agent_input_items,
                    "assistant_output": agent_assistant_output,
                    "department_id": department_id if department_id else None,
                },
            )

            # Get messages from new agent run
            agent_messages_row = await conn.fetchrow(sql_get_messages, agent_run_id)
            if not agent_messages_row:
                raise ValueError(
                    f"No messages found for dynamic agent run {agent_run_id}"
                )

            messages_json = agent_messages_row["messages"]
            if isinstance(messages_json, str):
                messages_json = json.loads(messages_json)

            logger.info(
                f"Completed dynamic agent run {agent_run_id}, proceeding with eval_agent grading"
            )

        # 3. Get rubric and eval_agent from rubric_grade_agent
        rga_params = InfrastructureEvalsGetRubricGradeAgentSqlParams(
            rubric_grade_agent_id=uuid.UUID(rubric_grade_agent_id)
        )
        rga_result = cast(
            InfrastructureEvalsGetRubricGradeAgentSqlRow,
            await execute_sql_typed(
                conn,
                "app/sql/v4/infrastructure/evals/get_rubric_grade_agent_v4_complete.sql",
                params=rga_params,
            ),
        )
        if not rga_result:
            raise ValueError(f"Rubric grade agent not found: {rubric_grade_agent_id}")
        
        rga_row = {
            "rubric_id": rga_result.rubric_id,
            "eval_agent_id": rga_result.eval_agent_id,
        }
        if not rga_row:
            raise ValueError(f"Rubric grade agent not found: {rubric_grade_agent_id}")

        rubric_id = rga_row["rubric_id"]
        eval_agent_id = rga_row["eval_agent_id"]

        # 4. Get eval_agent context (using eval_id and run_id to query from junction table)
        sql_get_context = load_sql("app/sql/v4/evals/get_eval_agent_context.sql")
        context_row = await conn.fetchrow(
            sql_get_context, eval_id, run_id, None, department_id, profile_id
        )
        if not context_row:
            raise ValueError(
                f"Eval agent context not found for eval {eval_id}, run {run_id}"
            )

        context = dict(context_row)

        # 5. Get department_id from original run if not provided (if not already set in dynamic mode)
        if not department_id:
            dept_params2 = InfrastructureEvalsGetDepartmentFromRunSqlParams(
                run_id=uuid.UUID(run_id)
            )
            dept_result2 = cast(
                InfrastructureEvalsGetDepartmentFromRunSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/infrastructure/evals/get_department_from_run_v4_complete.sql",
                    params=dept_params2,
                ),
            )
            if dept_result2 and dept_result2.department_id:
                department_id = dept_result2.department_id

        # 6. Create test if not exists
        if not test_id:
            trace_id = f"eval_{attempt_id}_{run_id}"
            test_title = f"Eval Test for Run {run_id[:8]}"
            # We'll create the test after creating the run
            test_id = None

        # 7. Create run for eval_agent
        sql_create_run = load_sql("app/sql/v4/model_runs/create_model_run_complete.sql")
        eval_run_row = await conn.fetchrow(
            sql_create_run,
            department_id,
            context["model_id"],
            eval_agent_id,
            "agent",
            context["profile_id"],
            None,  # key_id
            eval_agent_id,  # agent_id
        )
        if not eval_run_row:
            raise ValueError("Failed to create eval run")

        eval_run_id = eval_run_row["run_id"]

        # 8. Create test now that we have eval_run_id
        if not test_id:
            trace_id = f"eval_{attempt_id}_{run_id}"
            test_title = f"Eval Test for Run {run_id[:8]}"
            test_params = InfrastructureEvalsCreateTestSqlParams(
                title=test_title,
                run_id=uuid.UUID(eval_run_id),
                trace_id=trace_id,
            )
            test_result = cast(
                InfrastructureEvalsCreateTestSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/infrastructure/evals/create_test_v4_complete.sql",
                    params=test_params,
                ),
            )
            if not test_result or not test_result.test_id:
                raise ValueError("Failed to create test")

            test_id = test_result.test_id

            # Link test to attempt
            link_attempt_params = InfrastructureEvalsLinkAttemptTestSqlParams(
                attempt_id=uuid.UUID(attempt_id),
                test_id=uuid.UUID(test_id),
            )
            await execute_sql_typed(
                conn,
                "app/sql/v4/infrastructure/evals/link_attempt_test_v4_complete.sql",
                params=link_attempt_params,
            )

            # Link run to test
            link_run_params = InfrastructureEvalsLinkTestRunSqlParams(
                run_id=uuid.UUID(eval_run_id),
                test_id=uuid.UUID(test_id),
            )
            await execute_sql_typed(
                conn,
                "app/sql/v4/infrastructure/evals/link_test_run_v4_complete.sql",
                params=link_run_params,
            )

        # 9. Prepare messages: Convert to TResponseInputItem format and filter out system/developer messages
        # Filter out system and developer messages (they contain original agent's prompt)
        # Keep only user and assistant messages
        input_items: list[TResponseInputItem] = []
        for msg in messages_json:
            role = msg.get("role", "")
            content = msg.get("content", "")
            # Only include user and assistant messages
            if role in ("user", "assistant", "response"):
                # Map "response" to "assistant" for consistency
                mapped_role = "assistant" if role == "response" else role
                input_items.append({"role": mapped_role, "content": content})  # type: ignore[list-item]

        # 10. Create GenericAgent with eval_agent's context
        eval_agent = GenericAgent(
            agent_name=context["agent_name"],
            system_prompt=context["system_prompt"],
            temperature=context["temperature"],
            model_name=context["model_name"],
            provider=context["provider"],
            api_key=context["api_key"],
            base_url=context["base_url"] if context["base_url"] else None,
            reasoning=context["reasoning"],
        )

        # 11. Log system prompt and messages inline
        eval_run_id_uuid = uuid.UUID(eval_run_id)
        if context["system_prompt"]:
            sql_link_sys_dev = load_sql(
                "app/sql/v4/model_runs/link_system_developer_messages_to_run.sql"
            )
            await conn.fetchrow(
                sql_link_sys_dev,
                str(eval_run_id_uuid),
                str(uuid.UUID(department_id)) if department_id else None,
                None,  # chat_id
            )

        # Link developer messages from input_items if provided
        developer_contents_eval: list[str] = []
        if input_items:
            developer_messages = [
                item
                for item in input_items
                if item and isinstance(item, dict) and item.get("role") == "developer"
            ]
            for dev_msg in developer_messages:
                content = dev_msg.get("content", "")
                if isinstance(content, str):
                    stripped = content.strip()
                    if stripped:
                        developer_contents_eval.append(stripped)

        # Link each developer message to the run
        sql_link_dev = load_sql(
            "app/sql/v4/simulations/link_developer_message_to_run.sql"
        )
        developer_message_ids_eval: list[uuid.UUID] = []
        for content in developer_contents_eval:
            result = await conn.fetchrow(
                sql_link_dev,
                content,
                str(eval_run_id_uuid),
            )
            if result and result.get("message_id"):
                message_id = result["message_id"]
                if isinstance(message_id, uuid.UUID):
                    developer_message_ids_eval.append(message_id)
                else:
                    developer_message_ids_eval.append(uuid.UUID(str(message_id)))

        # 12. Run eval_agent
        logger.info(f"Running eval_agent {eval_agent_id} for run {run_id}")
        with trace(
            f"Eval Agent Run {run_id[:8]}",
            trace_id=f"eval_{attempt_id}_{run_id}",
            group_id=str(attempt_id),
        ):
            # Convert input items to message format
            messages = [
                {"role": item.get("role", "user"), "content": item.get("content", "")}
                for item in input_items
            ]
            
            # Get model config from agent
            model_config = eval_agent.get_model_config()
            
            # Run agent with tools
            result = await run_agent_with_tools(
                messages=messages,
                tools=None,  # Eval agents don't use tools
                tool_functions=eval_agent.get_tool_functions(),
                model=model_config["model"],
                api_key=model_config["api_key"],
                base_url=model_config.get("base_url"),
                temperature=model_config["temperature"],
                system_prompt=eval_agent.get_system_prompt(),
            )

        # 13. Save assistant output message
        usage = result.context_wrapper.usage
        assistant_output = getattr(result, "final_output", None) or ""

        if assistant_output and assistant_output.strip():
            # Get the parent message ID (developer if exists, otherwise system)
            parent_message_id_eval: uuid.UUID | None = None

            # Try to get developer message ID (use the last one if multiple)
            if developer_message_ids_eval:
                parent_message_id_eval = developer_message_ids_eval[-1]
            else:
                # Get system message ID from the run
                sys_dev_result = await conn.fetchrow(
                    load_sql(
                        "app/sql/v4/model_runs/link_system_developer_messages_to_run.sql"
                    ),
                    str(eval_run_id_uuid),
                    str(uuid.UUID(department_id)) if department_id else None,
                    None,  # chat_id
                )
                if sys_dev_result and sys_dev_result.get("system_message_id"):
                    system_msg_id = sys_dev_result["system_message_id"]
                    if isinstance(system_msg_id, uuid.UUID):
                        parent_message_id_eval = system_msg_id
                    else:
                        parent_message_id_eval = uuid.UUID(str(system_msg_id))

            # Create assistant message with branch
            sql_create_assistant = load_sql(
                "app/sql/v4/messages_create_assistant_message_with_branch.sql"
            )
            await conn.fetchrow(
                sql_create_assistant,
                assistant_output.strip(),
                str(eval_run_id_uuid),
                str(parent_message_id_eval) if parent_message_id_eval else None,
            )

        # 14. Handle pricing_logs (emit log_run event via internal_sio)
        await internal_sio.emit(
            "log_run",
            {
                "run_id": eval_run_id,
                "operation_type": "eval",
                "input_text_tokens": usage.input_tokens,
                "output_text_tokens": usage.output_tokens,
                "system_prompt": context.get("system_prompt"),
                "input_items": input_items,  # Serialized TResponseInputItem list
                "assistant_output": assistant_output,
                "department_id": department_id if department_id else None,
            },
        )

        # 15. Grade the result (create grade via create_eval_grade.sql)
        # For now, use placeholder grading logic (similar to run_eval_worker.py)
        rubric_params2 = InfrastructureEvalsGetRubricDetailsSqlParams(
            rubric_id=uuid.UUID(rubric_id)
        )
        rubric_result2 = cast(
            InfrastructureEvalsGetRubricDetailsSqlRow,
            await execute_sql_typed(conn, GET_RUBRIC_DETAILS_SQL_PATH, params=rubric_params2),
        )
        if not rubric_result2:
            raise ValueError(f"Rubric not found: {rubric_id}")
        
        rubric = {
            "id": rubric_result2.id,
            "name": rubric_result2.name,
            "points": rubric_result2.points,
            "pass_points": rubric_result2.pass_points,
        }

        # Placeholder: Create a grade with default values
        # TODO: Implement actual grading logic using eval_agent's output
        grade_sql = load_sql("app/sql/v4/evals/create_eval_grade.sql")
        grade_result = await conn.fetchrow(
            grade_sql,
            eval_run_id,  # run_id (the eval_agent's run)
            eval_id,  # eval_id (unused but kept for API compatibility)
            "Evaluation completed",  # description
            True,  # passed (placeholder)
            rubric["points"],  # score (placeholder - use full points)
            0,  # time_taken (placeholder)
            rubric_grade_agent_id,  # rubric_grade_agent_id
        )

        if not grade_result:
            raise ValueError("Failed to create eval grade")

        grade_id = grade_result["grade_id"]

        # 16. Mark test as completed
        mark_test_params = InfrastructureEvalsMarkTestCompleteSqlParams(
            test_id=uuid.UUID(test_id)
        )
        await execute_sql_typed(
            conn,
            "app/sql/v4/infrastructure/evals/mark_test_complete_v4_complete.sql",
            params=mark_test_params,
        )

        # 17. Mark eval_runs.completed = true for this run
        mark_eval_params = InfrastructureEvalsMarkEvalRunCompleteSqlParams(
            eval_id=uuid.UUID(eval_id),
            run_id=uuid.UUID(run_id),
        )
        await execute_sql_typed(
            conn,
            "app/sql/v4/infrastructure/evals/mark_eval_run_complete_v4_complete.sql",
            params=mark_eval_params,
        )

        # 18. Emit progress event via WebSocket
        if emit_progress_func:
            await emit_progress_func(
                {
                    "eval_id": eval_id,
                    "run_id": run_id,
                    "test_id": test_id,
                    "status": "completed",
                    "message": f"Completed evaluation for run {run_id[:8]}",
                    "grade_id": grade_id,
                }
            )

        logger.info(f"Completed eval {eval_id} for run {run_id}")

        return {
            "success": True,
            "test_id": test_id,
            "eval_run_id": eval_run_id,
            "grade_id": grade_id,
        }

    except Exception as e:
        logger.error(
            f"Error evaluating run {run_id} for eval {eval_id}: {e}", exc_info=True
        )

        # Mark test as completed with error if it exists
        if test_id:
            try:
                error_test_params = InfrastructureEvalsMarkTestCompleteSqlParams(
                    test_id=uuid.UUID(test_id)
                )
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/infrastructure/evals/mark_test_complete_v4_complete.sql",
                    params=error_test_params,
                )
            except Exception:
                pass

        # Mark eval_runs as completed with error
        try:
            error_eval_params = InfrastructureEvalsMarkEvalRunCompleteSqlParams(
                eval_id=uuid.UUID(eval_id),
                run_id=uuid.UUID(run_id),
            )
            await execute_sql_typed(
                conn,
                "app/sql/v4/infrastructure/evals/mark_eval_run_complete_v4_complete.sql",
                params=error_eval_params,
            )
        except Exception:
            pass

        # Emit error event
        if emit_progress_func:
            await emit_progress_func(
                {
                    "eval_id": eval_id,
                    "run_id": run_id,
                    "status": "error",
                    "message": f"Error: {str(e)}",
                }
            )

        raise
