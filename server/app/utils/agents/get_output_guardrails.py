"""Return a list of output guardrails suitable for attaching to an Agent."""

import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import (
    Agent,
    GuardrailFunctionOutput,
    OutputGuardrail,
    RunContextWrapper,
    TContext,
)
from agents.items import TResponseInputItem
from fastapi import Depends

from app.main import get_db
from app.utils.agents.run_guardrail_evaluation import run_guardrail_evaluation
from app.utils.sql_helper import load_sql

logger = __import__("logging").getLogger(__name__)


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
        context_row = await conn.fetchrow(
            sql, str(chat_id), str(department_id), "output"
        )

        if not context_row:
            raise ValueError(
                f"Chat {chat_id} not found or no output guardrail agent configured"
            )

        context = {
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"])
            if context_row["temperature"] is not None
            else 0.0,
            "reasoning": context_row["reasoning"],
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "provider": context_row["provider"],
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
