import uuid

import asyncpg  # type: ignore
from agents import Runner, trace
from fastapi import Depends

from app.agents.generic import GenericAgent
from app.db import get_db
from app.utils.sql_helper import load_sql
from app.utils.debug_info import DebugContext


async def run_title_agent(
    chat_id: uuid.UUID,
    initial_message: str,
    department_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
) -> str:
    """
    This function is used to run the title agent for simulation chats.
    Returns a string of the simulation_chat_title id.
    """

    # Get all agent/model/provider/chat data in single query using SQL file
    sql = load_sql("sql/v3/agents/get_title_run_context.sql")
    context_row = await conn.fetchrow(sql, str(chat_id), str(department_id))
    
    if not context_row:
        raise ValueError(f"Chat {chat_id} not found or no title agent configured")
    
    context = {
        "agent_id": context_row["agent_id"],
        "name": context_row["agent_name"],
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
        "profile_id": context_row["profile_id"],
        "req_per_day": context_row["req_per_day"],
        "runs_today_count": context_row["runs_today_count"],
        "earliest_run_created_at": context_row["earliest_run_created_at"],
    }

    agent_instance = GenericAgent(
        agent_name=context["name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        model_provider=context["provider_name"],
        base_url=context["base_url"],
        reasoning=context["reasoning"],
        api_key=context["api_key"],
        custom_model=context["custom_model"],
    )

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

    # Create model run with all junction records using SQL file
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

    with trace(context["chat_title"], trace_id=context["trace_id"]):
        result = await Runner.run(
            agent_instance.agent(),
            input=[{"role": "user", "content": initial_message}],
            context=DebugContext(conn=conn, model_run_id=model_run_id),
        )

    title = result.final_output

    usage = result.context_wrapper.usage

    # Update model run tokens using SQL file
    sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
    await conn.execute(
        sql_update_tokens,
        str(model_run_id),
        usage.input_tokens,
        usage.output_tokens,
    )

    # add the title to the trace by making an empty call
    with trace(title, trace_id=context["trace_id"]):
        pass

    # Update the chat title using SQL file
    sql_update_title = load_sql("sql/v3/assistant/update_chat_title.sql")
    await conn.execute(sql_update_title, str(chat_id), title)

    return str(title)
