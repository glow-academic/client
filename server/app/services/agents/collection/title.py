import uuid

from agents import Runner, trace
from app.db import get_session
from app.models import Agents, AssistantChats, ModelRuns, Models, Providers
from app.services.agents.generic import GenericAgent
from fastapi import Depends
from sqlmodel import Session, select


async def run_title_agent(
    chat_id: uuid.UUID, initial_message: str, session: Session = Depends(get_session)
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
    )

    with trace(chat.title, trace_id=chat.trace_id):
        result = await Runner.run(
            agent_instance.agent(),
            input=[{"role": "user", "content": initial_message}],
        )

    title = result.final_output

    usage = result.context_wrapper.usage

    # create model run
    model_run = ModelRuns(
        model_id=model.id,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
        profile_id=chat.profile_id,
        agent_id=agent.id,
    )
    session.add(model_run)
    session.commit()

    # add the title to the trace by making an empty call
    with trace(title, trace_id=chat.trace_id):
        pass

    # update the title to the chat
    chat.title = title
    session.add(chat)
    session.commit()

    return chat.title
