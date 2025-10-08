import uuid

from agents import Runner, trace
from app.db import get_session
from app.models import Agents, AssistantChats, ModelRuns, Models, Providers
from app.services.agents.generic import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from fastapi import Depends
from sqlmodel import Session, select


async def run_title_agent(
    chat_id: uuid.UUID, initial_message: str, department_id: uuid.UUID, session: Session = Depends(get_session)
) -> str:
    """
    This function is used to run the title agent for simulation chats.
    Returns a string of the simulation_chat_title id.
    """

    # find agent with name of "Title"
    agent = session.exec(select(Agents).where(Agents.name == "Title")).one()
    if not agent:
        raise ValueError("Title agent not found")

    # find chat with id
    chat = session.exec(
        select(AssistantChats).where(AssistantChats.id == chat_id)
    ).one()
    if not chat:
        raise ValueError("Chat not found")

    # getting the model from the agent's model_id
    model = session.exec(select(Models).where(Models.id == agent.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent.model_id} not found")

    # getting the provider from the model's provider_id
    provider = session.exec(
        select(Providers).where(Providers.id == model.provider_id)
    ).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    agent_instance = GenericAgent(
        agent_name=agent.name,
        system_prompt=agent.system_prompt,
        temperature=agent.temperature,
        model_name=model.name,
        model_provider=provider.name,
        base_url=provider.base_url,
        reasoning=agent.reasoning,
        api_key=provider.api_key,
        custom_model=model.custom_model,
    )

    default_guest_profile = find_default_guest_profile(session)

    final_profile_id = (chat.profile_id if chat.profile_id else (default_guest_profile.id if default_guest_profile else None))

    success, error_message = check_rate_limit(final_profile_id, session)
    if not success:
        raise ValueError(error_message)

    # create model run
    model_run = ModelRuns(
        model_id=model.id,
        input_tokens=0,
        output_tokens=0,
        profile_id=final_profile_id,
        agent_id=agent.id,
        department_id=department_id,
    )
    session.add(model_run)
    session.commit()

    with trace(chat.title, trace_id=chat.trace_id):
        result = await Runner.run(
            agent_instance.agent(),
            input=[{"role": "user", "content": initial_message}],
            context=DebugContext(session=session, model_run_id=model_run.id)
        )

    title = result.final_output

    usage = result.context_wrapper.usage

    model_run.input_tokens = usage.input_tokens
    model_run.output_tokens = usage.output_tokens
    session.commit()

    # add the title to the trace by making an empty call
    with trace(title, trace_id=chat.trace_id):
        pass

    # update the title to the chat
    chat.title = title
    session.add(chat)
    session.commit()

    return chat.title
