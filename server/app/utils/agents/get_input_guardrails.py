"""Return a list of input guardrails suitable for attaching to an Agent."""

import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import (
    Agent,
    GuardrailFunctionOutput,
    InputGuardrail,
    RunContextWrapper,
    TContext,
)
from agents.items import TResponseInputItem

from app.utils.agents.run_guardrail_evaluation import run_guardrail_evaluation
from app.utils.sql_helper import load_sql

logger = __import__("logging").getLogger(__name__)


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
        context_row = await conn.fetchrow(
            sql, str(chat_id), str(department_id), "input"
        )

        if not context_row:
            raise ValueError(
                f"Chat {chat_id} not found or no input guardrail agent configured"
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
