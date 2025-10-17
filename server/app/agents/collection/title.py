import uuid

import asyncpg  # type: ignore
from agents import Runner, trace
from app.agents.generic import GenericAgent
from app.db import get_db
from app.services.agent_service import AgentService
from app.services.assistant_service import AssistantService
from app.services.model_run_service import ModelRunService
from app.utils.debug_info import DebugContext
from fastapi import Depends


async def run_title_agent(
    chat_id: uuid.UUID, initial_message: str, department_id: uuid.UUID, conn: asyncpg.Connection = Depends(get_db),
) -> str:
    """
    This function is used to run the title agent for simulation chats.
    Returns a string of the simulation_chat_title id.
    """

    # Get all agent/model/provider/chat data in single query via service
    agent_service = AgentService(conn)
    context = await agent_service.get_title_run_context(
        chat_id=chat_id,
        department_id=department_id
    )

    agent_instance = GenericAgent(
        agent_name=context['name'],
        system_prompt=context['system_prompt'],
        temperature=context['temperature'],
        model_name=context['model_name'],
        model_provider=context['provider_name'],
        base_url=context['base_url'],
        reasoning=context['reasoning'],
        api_key=context['api_key'],
        custom_model=context['custom_model'],
    )

    # Create model run service and check rate limit
    model_run_service = ModelRunService(conn)
    success, error_message = await model_run_service.check_rate_limit(context['profile_id'])
    if not success:
        raise ValueError(error_message)

    # Create model run with all junction records
    model_run_id = await model_run_service.create_model_run(
        department_id=department_id,
        model_id=uuid.UUID(context['model_id']),
        entity_id=uuid.UUID(context['agent_id']),
        entity_type="agent",
        profile_id=context['profile_id'],
    )

    with trace(context['chat_title'], trace_id=context['trace_id']):
        result = await Runner.run(
            agent_instance.agent(),
            input=[{"role": "user", "content": initial_message}],
            context=DebugContext(conn=conn, model_run_id=model_run_id)
        )

    title = result.final_output

    usage = result.context_wrapper.usage

    # Update model run tokens
    await model_run_service.update_model_run_tokens(
        model_run_id=model_run_id,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
    )

    # add the title to the trace by making an empty call
    with trace(title, trace_id=context['trace_id']):
        pass

    # Update the chat title via service layer
    assistant_service = AssistantService(conn)
    await assistant_service.update_chat_title(chat_id=chat_id, title=title)

    return str(title)
