"""Eval runner utility - evaluates a single run by calling eval_agent with messages from original run."""

import json
import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import Runner, trace
from agents.items import TResponseInputItem

from app.main import get_internal_sio
from app.utils.agents.generic_agent import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.logging.db_logger import get_logger
from app.utils.messages.log_run_messages import log_run_messages
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()


async def run_eval_single_run(
    conn: asyncpg.Connection,
    eval_id: str,
    attempt_id: str,
    test_id: str | None,
    run_id: str,
    eval_agent_id: str,
    rubric_id: str,
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
        eval_agent_id: The eval agent ID (agent performing evaluation)
        rubric_id: The rubric ID for grading
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
        completed_check = await conn.fetchrow(
            """
            SELECT completed
            FROM eval_runs
            WHERE eval_id = $1::uuid AND run_id = $2::uuid
            """,
            eval_id,
            run_id,
        )
        if completed_check and completed_check["completed"]:
            logger.info(
                f"Run {run_id} already completed for eval {eval_id}, skipping (idempotent)"
            )
            # Return existing test_id if available
            existing_test = await conn.fetchrow(
                """
                SELECT t.id::text as test_id
                FROM tests t
                JOIN attempt_tests at ON at.test_id = t.id
                WHERE at.attempt_id = $1::uuid
                  AND t.trace_id = $2
                LIMIT 1
                """,
                attempt_id,
                f"eval_{attempt_id}_{run_id}",
            )
            return {
                "success": True,
                "test_id": existing_test["test_id"] if existing_test else None,
                "eval_run_id": None,  # Already exists
                "grade_id": None,  # Already exists
            }

        # Idempotency check: If test exists and is in progress, skip
        test_check = await conn.fetchrow(
            """
            SELECT t.id::text as test_id, t.completed
            FROM tests t
            JOIN attempt_tests at ON at.test_id = t.id
            WHERE at.attempt_id = $1::uuid
              AND t.trace_id = $2
              AND t.completed = false
            LIMIT 1
            """,
            attempt_id,
            f"eval_{attempt_id}_{run_id}",
        )
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
        sql_get_messages = load_sql("sql/v3/evals/get_run_messages_for_eval.sql")
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
            sql_get_agent_context = load_sql("sql/v3/evals/get_agent_context.sql")
            agent_context_row = await conn.fetchrow(
                sql_get_agent_context, agent_id, department_id, profile_id
            )
            if not agent_context_row:
                raise ValueError(f"Agent context not found for agent {agent_id}")
            
            agent_context = dict(agent_context_row)
            
            # Modify system prompt (placeholder - can be replaced via WebSocket)
            # For now, append a note that this is a dynamic evaluation
            modified_system_prompt = agent_context["system_prompt"] + "\n\n[Note: This is a dynamic evaluation run with modified system prompt]"
            
            # Get department_id from original run if not provided
            if not department_id:
                dept_row = await conn.fetchrow(
                    """
                    SELECT d.id::text as department_id
                    FROM runs r
                    JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
                    JOIN profile_departments pd ON pd.profile_id = rp.profile_id AND pd.active = true
                    JOIN departments d ON d.id = pd.department_id AND d.active = true
                    WHERE r.id = $1::uuid
                    LIMIT 1
                    """,
                    run_id,
                )
                if dept_row:
                    department_id = dept_row["department_id"]
            
            # Create new run for agent being evaluated
            sql_create_agent_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
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
                base_url=agent_context["base_url"] if agent_context["base_url"] else None,
                reasoning=agent_context["reasoning"],
            )
            
            # Log system prompt and messages for agent run
            await log_run_messages(
                conn=conn,
                run_id=uuid.UUID(agent_run_id),
                system_prompt=modified_system_prompt,
                input_items=agent_input_items,
                department_id=uuid.UUID(department_id) if department_id else None,
            )
            
            # Run agent being evaluated with modified prompt
            logger.info(f"Running agent {agent_id} with modified prompt for dynamic eval (run {run_id})")
            with trace(
                f"Dynamic Agent Run {run_id[:8]}",
                trace_id=f"dynamic_{attempt_id}_{run_id}",
                group_id=str(attempt_id),
            ):
                agent_result = await Runner.run(
                    agent.agent(),
                    input=agent_input_items,
                    context=DebugContext(conn=conn, run_id=uuid.UUID(agent_run_id)),
                )
            
            # Save assistant output from agent run
            agent_usage = agent_result.context_wrapper.usage
            agent_assistant_output = getattr(agent_result, "final_output", None) or ""
            
            if agent_assistant_output:
                await log_run_messages(
                    conn=conn,
                    run_id=uuid.UUID(agent_run_id),
                    system_prompt=None,  # Already logged above
                    assistant_output=agent_assistant_output,
                )
            
            # Handle pricing/logs for agent run
            await internal_sio.emit(
                "log_run",
                {
                    "runId": agent_run_id,
                    "operationType": "eval",
                    "inputTextTokens": agent_usage.input_tokens,
                    "outputTextTokens": agent_usage.output_tokens,
                    "systemPrompt": modified_system_prompt,
                    "inputItems": agent_input_items,
                    "assistantOutput": agent_assistant_output,
                    "departmentId": department_id if department_id else None,
                },
            )
            
            # Get messages from new agent run
            agent_messages_row = await conn.fetchrow(sql_get_messages, agent_run_id)
            if not agent_messages_row:
                raise ValueError(f"No messages found for dynamic agent run {agent_run_id}")
            
            messages_json = agent_messages_row["messages"]
            if isinstance(messages_json, str):
                messages_json = json.loads(messages_json)
            
            logger.info(f"Completed dynamic agent run {agent_run_id}, proceeding with eval_agent grading")

        # 3. Get eval_agent context
        sql_get_context = load_sql("sql/v3/evals/get_eval_agent_context.sql")
        context_row = await conn.fetchrow(
            sql_get_context, eval_agent_id, department_id, profile_id
        )
        if not context_row:
            raise ValueError(f"Eval agent context not found for agent {eval_agent_id}")

        context = dict(context_row)

        # 4. Get department_id from original run if not provided (if not already set in dynamic mode)
        if not department_id:
            dept_row = await conn.fetchrow(
                """
                SELECT d.id::text as department_id
                FROM runs r
                JOIN run_profiles rp ON rp.run_id = r.id AND rp.active = true
                JOIN profile_departments pd ON pd.profile_id = rp.profile_id AND pd.active = true
                JOIN departments d ON d.id = pd.department_id AND d.active = true
                WHERE r.id = $1::uuid
                LIMIT 1
                """,
                run_id,
            )
            if dept_row:
                department_id = dept_row["department_id"]

        # 5. Create test if not exists
        if not test_id:
            trace_id = f"eval_{attempt_id}_{run_id}"
            test_title = f"Eval Test for Run {run_id[:8]}"
            # We'll create the test after creating the run
            test_id = None

        # 6. Create run for eval_agent
        sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
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

        # 7. Create test now that we have eval_run_id
        if not test_id:
            trace_id = f"eval_{attempt_id}_{run_id}"
            test_title = f"Eval Test for Run {run_id[:8]}"
            test_row = await conn.fetchrow(
                """
                INSERT INTO tests (title, run_id, completed, trace_id, created_at, updated_at)
                VALUES ($1, $2::uuid, false, $3, NOW(), NOW())
                RETURNING id::text as test_id
                """,
                test_title,
                eval_run_id,
                trace_id,
            )
            if not test_row:
                raise ValueError("Failed to create test")

            test_id = test_row["test_id"]

            # Link test to attempt
            await conn.execute(
                """
                INSERT INTO attempt_tests (attempt_id, test_id, created_at, updated_at)
                VALUES ($1::uuid, $2::uuid, NOW(), NOW())
                ON CONFLICT (attempt_id, test_id) DO NOTHING
                """,
                attempt_id,
                test_id,
            )

            # Link run to test
            await conn.execute(
                """
                INSERT INTO test_runs (run_id, test_id, created_at, updated_at)
                VALUES ($1::uuid, $2::uuid, NOW(), NOW())
                ON CONFLICT (run_id, test_id) DO NOTHING
                """,
                eval_run_id,
                test_id,
            )

        # 8. Prepare messages: Convert to TResponseInputItem format and filter out system/developer messages
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

        # 9. Create GenericAgent with eval_agent's context
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

        # 10. Log system prompt and messages
        await log_run_messages(
            conn=conn,
            run_id=uuid.UUID(eval_run_id),
            system_prompt=context["system_prompt"],
            input_items=input_items,
            department_id=uuid.UUID(department_id) if department_id else None,
        )

        # 11. Run eval_agent
        logger.info(f"Running eval_agent {eval_agent_id} for run {run_id}")
        with trace(
            f"Eval Agent Run {run_id[:8]}",
            trace_id=f"eval_{attempt_id}_{run_id}",
            group_id=str(attempt_id),
        ):
            result = await Runner.run(
                eval_agent.agent(),
                input=input_items,
                context=DebugContext(conn=conn, run_id=uuid.UUID(eval_run_id)),
            )

        # 12. Save assistant output message
        usage = result.context_wrapper.usage
        assistant_output = getattr(result, "final_output", None) or ""

        if assistant_output:
            await log_run_messages(
                conn=conn,
                run_id=uuid.UUID(eval_run_id),
                system_prompt=None,  # Already logged above
                assistant_output=assistant_output,
            )

        # 13. Handle pricing/logs (emit log_run event via internal_sio)
        await internal_sio.emit(
            "log_run",
            {
                "runId": eval_run_id,
                "operationType": "eval",
                "inputTextTokens": usage.input_tokens,
                "outputTextTokens": usage.output_tokens,
                "systemPrompt": context["system_prompt"],
                "inputItems": input_items,  # Serialized TResponseInputItem list
                "assistantOutput": assistant_output,
                "departmentId": department_id if department_id else None,
            },
        )

        # 14. Grade the result (create grade via create_eval_grade.sql)
        # For now, use placeholder grading logic (similar to run_eval_worker.py)
        rubric = await conn.fetchrow(
            "SELECT id, name, points, pass_points FROM rubrics WHERE id = $1",
            rubric_id,
        )
        if not rubric:
            raise ValueError(f"Rubric not found: {rubric_id}")

        # Placeholder: Create a grade with default values
        # TODO: Implement actual grading logic using eval_agent's output
        grade_sql = load_sql("sql/v3/evals/create_eval_grade.sql")
        grade_result = await conn.fetchrow(
            grade_sql,
            eval_run_id,  # run_id (the eval_agent's run)
            eval_id,  # eval_id (unused but kept for API compatibility)
            "Evaluation completed",  # description
            True,  # passed (placeholder)
            rubric["points"],  # score (placeholder - use full points)
            0,  # time_taken (placeholder)
            rubric_id,  # rubric_id
        )

        if not grade_result:
            raise ValueError("Failed to create eval grade")

        grade_id = grade_result["grade_id"]

        # 15. Mark test as completed
        await conn.execute(
            """
            UPDATE tests SET completed = true, updated_at = NOW()
            WHERE id = $1::uuid
            """,
            test_id,
        )

        # 16. Mark eval_runs.completed = true for this run
        await conn.execute(
            """
            UPDATE eval_runs SET completed = true, updated_at = NOW()
            WHERE eval_id = $1::uuid AND run_id = $2::uuid
            """,
            eval_id,
            run_id,
        )

        # 17. Emit progress event via WebSocket
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
        logger.error(f"Error evaluating run {run_id} for eval {eval_id}: {e}", exc_info=True)

        # Mark test as completed with error if it exists
        if test_id:
            try:
                await conn.execute(
                    """
                    UPDATE tests SET completed = true, updated_at = NOW()
                    WHERE id = $1::uuid
                    """,
                    test_id,
                )
            except Exception:
                pass

        # Mark eval_runs as completed with error
        try:
            await conn.execute(
                """
                UPDATE eval_runs SET completed = true, updated_at = NOW()
                WHERE eval_id = $1::uuid AND run_id = $2::uuid
                """,
                eval_id,
                run_id,
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

