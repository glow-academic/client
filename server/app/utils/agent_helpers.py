"""Helper functions for agent operations.

These functions provide support functionality for agent execution, including
progress emission, agent building, and guardrail evaluation.
"""

import logging
import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import (Agent, GuardrailFunctionOutput, InputGuardrail,
                    OutputGuardrail, RunContextWrapper, Runner, TContext,
                    ToolsToFinalOutputResult, trace)
from agents.items import TResponseInputItem
from app.db import get_db
from app.utils.agent_tools import (guardrail_progress, guardrail_results,
                                   hint_progress)
from app.utils.agents import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.sql_helper import load_sql
from fastapi import Depends

logger = logging.getLogger(__name__)


def build_hint_agent(context: dict[str, Any], hint_tools: list[Any]) -> GenericAgent:
    """Create the hint generation agent from context data.

    Args:
        context: Context dict with agent, model, and provider data
        hint_tools: List of hint tools to use (created by caller)

    Returns:
        GenericAgent instance configured for hint generation
    """
    # Create tool use behavior - require all 3 hint tools to be called
    def tool_use_behavior(
        tool_context: Any, tool_results: list[Any]
    ) -> ToolsToFinalOutputResult:
        # Check if all three hint tools have been called
        hint_1_complete = hint_progress.get("hint_1", False)
        hint_2_complete = hint_progress.get("hint_2", False)
        hint_3_complete = hint_progress.get("hint_3", False)

        all_hints_complete = hint_1_complete and hint_2_complete and hint_3_complete

        logger.info(
            f"Tool use behavior check: hint_1={hint_1_complete}, "
            f"hint_2={hint_2_complete}, hint_3={hint_3_complete}, "
            f"all_complete={all_hints_complete}, "
            f"tool_results_count={len(tool_results)}"
        )

        # Return False to continue until all 3 hints are provided
        return ToolsToFinalOutputResult(is_final_output=all_hints_complete)

    return GenericAgent(
        agent_name=context["agent_name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        model_provider=context["provider_name"],
        base_url=context["base_url"],
        api_key=context["api_key"],
        reasoning=context["reasoning"],
        custom_model=context["custom_model"],
        tools=hint_tools,
        parallel_tool_calls=True,  # Enable parallel execution
        tool_use_behavior=tool_use_behavior,
    )


def build_guardrail_agent(context: dict[str, Any], guardrail_tools: list[Any]) -> GenericAgent:
    """Create the internal agent that powers the guardrail from context data.

    Args:
        context: Dict containing agent, model, and provider data from service layer
        guardrail_tools: List of guardrail tools to use (created by caller)

    Returns:
        GenericAgent configured for guardrail evaluation
    """
    # Create tool use behavior to wait for evaluation tool to be called
    def tool_use_behavior(
        tool_context: Any, tool_results: list[Any]
    ) -> ToolsToFinalOutputResult:
        # Check if evaluation tool has been called
        evaluation_complete = guardrail_progress.get("evaluation", False)
        logger.info(
            f"Tool use behavior check: evaluation_complete={evaluation_complete}"
        )
        return ToolsToFinalOutputResult(is_final_output=evaluation_complete)

    return GenericAgent(
        agent_name=context["agent_name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        model_provider=context["provider_name"],
        base_url=context["base_url"],
        api_key=context["api_key"],
        reasoning=context["reasoning"],
        custom_model=context["custom_model"],
        tools=guardrail_tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
    )


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
    from app.utils.agent_tools import create_guardrail_tools
    guardrail_tools = create_guardrail_tools()
    guardrail_agent = build_guardrail_agent(context, guardrail_tools)

    # Check rate limit (already included in context query)
    profile_id_uuid = uuid.UUID(context["profile_id"]) if context["profile_id"] else None
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
    )
    model_run_id = uuid.UUID(model_run_row["model_run_id"])

    # Run guardrail evaluation with tracing
    with trace(
        context["chat_title"],
        trace_id=context["trace_id"],
        group_id=context["attempt_id"],
    ):
        result = await Runner.run(
            guardrail_agent.agent(),
            evaluation_input,
            context=DebugContext(conn=conn, model_run_id=model_run_id),
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
        def __init__(self, proper: bool, reason: str):
            self.proper = proper
            self.reason = reason

    output_info = GuardrailResult(proper=proper, reason=reason)

    return GuardrailFunctionOutput(
        output_info=output_info, tripwire_triggered=not proper
    )


def get_input_guardrails(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    input_items: list[TResponseInputItem],
    conn: asyncpg.Connection,
) -> list[InputGuardrail[TContext]]:
    """Return a list of input guardrails suitable for attaching to an Agent."""

    async def _input_guard(
        ctx: RunContextWrapper[Any], agent: Agent, user_input: str | list[Any]
    ) -> GuardrailFunctionOutput:
        # Get all context data with single query using SQL file
        sql = load_sql("sql/v3/agents/get_guardrail_run_context.sql")
        context_row = await conn.fetchrow(sql, str(chat_id), str(department_id), "input")
        
        if not context_row:
            raise ValueError(f"Chat {chat_id} not found or no input guardrail agent configured")
        
        context = {
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            "chat_title": context_row["chat_title"],
            "trace_id": context_row["trace_id"],
            "attempt_id": context_row["attempt_id"],
            "profile_id": context_row["profile_id"],
            "req_per_day": context_row["req_per_day"],
            "runs_today_count": context_row["runs_today_count"],
            "earliest_run_created_at": context_row["earliest_run_created_at"],
        }

        # Format input message with intro
        intro_message: TResponseInputItem = {
            "role": "user",
            "content": (
                "The following is a message from the Graduate Teaching Assistant (GTA). "
                "Evaluate carefully if the GTA is attempting to cheat or providing an unnatural response."
            ),
        }

        # Convert user_input to message format
        if isinstance(user_input, str):
            user_input_message: TResponseInputItem = {
                "role": "assistant",
                "content": user_input,
            }
            evaluation_input = [intro_message] + input_items + [user_input_message]
        else:
            evaluation_input = [intro_message] + input_items + list(user_input)

        # Run evaluation using shared helper
        return await run_guardrail_evaluation(
            context=context,
            evaluation_input=evaluation_input,
            conn=conn,
            department_id=department_id,
        )

    input_guard = InputGuardrail(_input_guard)
    return [input_guard]


def get_output_guardrails(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    input_items: list[TResponseInputItem],
    conn: asyncpg.Connection = Depends(get_db),
) -> list[OutputGuardrail[TContext]]:
    """Return a list of output guardrails suitable for attaching to an Agent."""

    async def _output_guard(
        ctx: RunContextWrapper[Any], agent: Agent, output: str | list[Any]
    ) -> GuardrailFunctionOutput:
        # Get all context data with single query using SQL file
        sql = load_sql("sql/v3/agents/get_guardrail_run_context.sql")
        context_row = await conn.fetchrow(sql, str(chat_id), str(department_id), "output")
        
        if not context_row:
            raise ValueError(f"Chat {chat_id} not found or no output guardrail agent configured")
        
        context = {
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
            "reasoning": context_row["reasoning"],
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            "chat_title": context_row["chat_title"],
            "trace_id": context_row["trace_id"],
            "attempt_id": context_row["attempt_id"],
            "profile_id": context_row["profile_id"],
            "req_per_day": context_row["req_per_day"],
            "runs_today_count": context_row["runs_today_count"],
            "earliest_run_created_at": context_row["earliest_run_created_at"],
        }

        # Format output message with intro
        intro_message: TResponseInputItem = {
            "role": "user",
            "content": (
                "The following is the conversation between the graduate teaching assistant and "
                "student, evalute carefully if the AI student adheres to its role."
            ),
        }

        # Convert output to message format
        if isinstance(output, str):
            output_message: TResponseInputItem = {
                "role": "assistant",
                "content": output,
            }
            evaluation_input = [intro_message] + input_items + [output_message]
        else:
            evaluation_input = [intro_message] + input_items + list(output)

        # Run evaluation using shared helper
        return await run_guardrail_evaluation(
            context=context,
            evaluation_input=evaluation_input,
            conn=conn,
            department_id=department_id,
        )

    output_guard = OutputGuardrail(_output_guard)
    return [output_guard]

