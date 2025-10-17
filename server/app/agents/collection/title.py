import uuid
from datetime import datetime, timezone

import asyncpg  # type: ignore
from agents import Runner, trace
from app.agents.generic import GenericAgent
from app.db import get_db
from app.utils.debug_info import DebugContext
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from fastapi import Depends


async def run_title_agent(
    chat_id: uuid.UUID, initial_message: str, department_id: uuid.UUID, conn: asyncpg.Connection = Depends(get_db),
) -> str:
    """
    This function is used to run the title agent for simulation chats.
    Returns a string of the simulation_chat_title id.
    """

    # Get the title agent configured for this department (via junction table)
    from app.utils.agents import get_department_agent
    agent = await get_department_agent(conn, department_id, 'title')

    # find chat with id
    chat = await conn.fetchrow(
        "SELECT id, profile_id, title, trace_id FROM assistant_chats WHERE id = $1",
        chat_id
    )
    if not chat:
        raise ValueError("Chat not found")

    # getting the model from the agent's model_id
    model = await conn.fetchrow(
        "SELECT id, name, provider_id, custom_model FROM models WHERE id = $1",
        agent['model_id']
    )
    if not model:
        raise ValueError(f"Model with ID {agent['model_id']} not found")

    # getting the provider from the model's provider_id
    provider = await conn.fetchrow(
        "SELECT id, name, base_url, api_key FROM providers WHERE id = $1",
        model['provider_id']
    )
    if not provider:
        raise ValueError(f"Provider with ID {model['provider_id']} not found")

    agent_instance = GenericAgent(
        agent_name=agent['name'],
        system_prompt=agent['system_prompt'],
        temperature=agent['temperature'],
        model_name=model['name'],
        model_provider=provider['name'],
        base_url=provider['base_url'],
        reasoning=agent['reasoning'],
        api_key=provider['api_key'],
        custom_model=model['custom_model'],
    )

    default_guest_profile = await find_default_guest_profile(conn)

    final_profile_id = (chat['profile_id'] if chat['profile_id'] else (default_guest_profile['id'] if default_guest_profile else None))

    success, error_message = await check_rate_limit(conn, final_profile_id)
    if not success:
        raise ValueError(error_message)

    # create model run
    model_run = await conn.fetchrow("""
        INSERT INTO model_runs (input_tokens, output_tokens, department_id, created_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id
    """, 0, 0, department_id, datetime.now(timezone.utc))

    model_run_id = model_run['id']

    # Create model_run junction records
    if model['id']:
        await conn.execute("""
            INSERT INTO model_run_models (model_run_id, model_id, active)
            VALUES ($1, $2, $3)
        """, model_run_id, model['id'], True)
    
    if agent['id']:
        await conn.execute("""
            INSERT INTO model_run_agents (model_run_id, agent_id, active)
            VALUES ($1, $2, $3)
        """, model_run_id, agent['id'], True)
    
    if final_profile_id:
        await conn.execute("""
            INSERT INTO model_run_profiles (model_run_id, profile_id, active)
            VALUES ($1, $2, $3)
        """, model_run_id, final_profile_id, True)

    with trace(chat['title'], trace_id=chat['trace_id']):
        result = await Runner.run(
            agent_instance.agent(),
            input=[{"role": "user", "content": initial_message}],
            context=DebugContext(conn=conn, model_run_id=model_run_id)
        )

    title = result.final_output

    usage = result.context_wrapper.usage

    # Update model run with token usage
    await conn.execute("""
        UPDATE model_runs 
        SET input_tokens = $1, output_tokens = $2 
        WHERE id = $3
    """, usage.input_tokens, usage.output_tokens, model_run_id)

    # add the title to the trace by making an empty call
    with trace(title, trace_id=chat['trace_id']):
        pass

    # update the title to the chat
    await conn.execute("""
        UPDATE assistant_chats 
        SET title = $1 
        WHERE id = $2
    """, title, chat_id)

    return str(title)
