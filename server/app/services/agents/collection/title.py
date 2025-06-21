import uuid

from agents import Runner, trace
from app.db import get_session
from app.models import Agents, AssistantChats
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
    chat = session.exec(select(AssistantChats).where(AssistantChats.id == chat_id)).one()
    if not chat:
        raise ValueError("Chat not found")

    agent_instance = GenericAgent(
        agent_name=agent.name,
        agent_prompt=agent.system_prompt,
        temperature=agent.temperature,
    )

    with trace(chat.title, trace_id=chat.trace_id) as chat_trace:
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=[{"role": "user", "content": initial_message}],
        )
        trace_id = chat_trace.trace_id

    # update the trace id to the chat for future reference, if it was orginally None
    if chat.trace_id is None:
        chat.trace_id = trace_id
        session.add(chat)
        session.commit()

    title = result.final_output

    # update the title to the chat
    chat.title = title
    session.add(chat)
    session.commit()

    return chat.title
