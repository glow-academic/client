"""Shared logic for running guardrail evaluation."""

import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import GuardrailFunctionOutput, Runner, trace
from agents.items import TResponseInputItem

from app.main import guardrail_progress, guardrail_results
from app.utils.agents.build_guardrail_agent import build_guardrail_agent
from app.utils.logging.db_logger import get_logger
from app.utils.agents.tools.create_guardrail_tools import create_guardrail_tools
from app.utils.debug_info import DebugContext
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


async def run_guardrail_evaluation(
    context: dict[str, Any],
    evaluation_input: list[TResponseInputItem],
    conn: asyncpg.Connection,
    department_id: uuid.UUID,
) -> GuardrailFunctionOutput:
    """Shared logic for running guardrail evaluation.

    Args:
        context: Context dict from agent service with all required data
        evaluation_input: Formatted messages for guardrail evaluation
        conn: Database connection
        department_id: Department ID

    Returns:
        GuardrailFunctionOutput with evaluation results
    """
    # Clear previous results
    guardrail_results.clear()
    guardrail_progress.clear()

    # Build guardrail agent from context
    guardrail_tools = create_guardrail_tools()
    guardrail_agent = build_guardrail_agent(context, guardrail_tools)

    # Check rate limit (already included in context query)
    profile_id_uuid = (
        uuid.UUID(context["profile_id"]) if context["profile_id"] else None
    )
    if not profile_id_uuid:
        raise ValueError("Profile not found. Please contact support.")

    req_per_day = context["req_per_day"]
    runs_today_count = context["runs_today_count"]

    if req_per_day is not None and runs_today_count >= req_per_day:
        # Rate limit exceeded - format error message
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

    # Create model run using SQL file
    sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
    model_run_row = await conn.fetchrow(
        sql_create_run,
        str(department_id),
        context["model_id"],
        context["agent_id"],
        "agent",
        context["profile_id"],
        None,  # key_id
        str(context["agent_id"]),  # agent_id
    )
    model_run_id = uuid.UUID(model_run_row["run_id"])

    # Run guardrail evaluation with tracing
    with trace(
        context["chat_title"],
        trace_id=context["trace_id"],
        group_id=context["attempt_id"],
    ):
        result = await Runner.run(
            guardrail_agent.agent(),
            evaluation_input,
            context=DebugContext(conn=conn, run_id=model_run_id),
        )

    # Update token counts using SQL file
    usage = result.context_wrapper.usage
    sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
    await conn.execute(
        sql_update_tokens,
        str(model_run_id),
        usage.input_tokens,
        usage.output_tokens,
    )

    # Extract evaluation results
    proper = guardrail_results.get("proper", True)
    reason = guardrail_results.get("reason", "No evaluation provided")

    logger.info(f"Guardrail evaluation: proper={proper}, reason={reason}")

    # Create result object
    class GuardrailResult:
        def __init__(self, proper: bool, reason: str) -> None:
            self.proper = proper
            self.reason = reason

    output_info = GuardrailResult(proper=proper, reason=reason)

    return GuardrailFunctionOutput(
        output_info=output_info, tripwire_triggered=not proper
    )
