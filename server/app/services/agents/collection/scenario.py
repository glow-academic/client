import logging
import uuid
from typing import List, Tuple

from agents import Runner, gen_trace_id, trace
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import Agents, Classes, Models, Providers
from app.services.agents.generic import GenericAgent
from app.utils.agents import get_agent_info
from app.utils.classes import get_class_info
from app.utils.document import get_document_info
from app.utils.scenario import (get_crowdedness_info, get_intensity_info,
                                get_location_info, get_seniority_info,
                                get_time_of_day_info, get_urgency_info)
from fastapi import Depends
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

class Scenario(BaseModel):
    title: str  # title
    scenario: str  # scenario


async def run_scenario_agent(
    agent_id: uuid.UUID | None = None,
    class_id: uuid.UUID | None = None,
    document_ids: List[uuid.UUID] | None = None,
    seniority: str | None = None,
    crowdedness: int | None = None,
    intensity: int | None = None,
    location: str | None = None,
    tod: str | None = None,
    urgency: str | None = None,
    group_id: uuid.UUID | None = None,
    session: Session = Depends(get_session),
) -> Tuple[str, str, str]:
    """
    This function is used to run the scenario agent.

    Args:
        agent_id: The ID of the agent
        class_id: The ID of the class
        document_ids: The IDs of the documents
        seniority: The seniority of the student
        crowdedness: The crowdedness of the class
        intensity: The intensity of the class
        location: The location of the class
        tod: The time of day of the class
        urgency: The urgency of the class
        group_id: The ID of the group
        session: The database session
    Returns:
        A tuple of (scenario_id, chat_title, trace_id).
    """

    # Get the agent to get its name for the agent
    if agent_id is None:
        agent_info = None
    else:
        agent = session.exec(select(Agents).where(Agents.id == agent_id)).one_or_none()
        if not agent:
            raise ValueError(f"Agent with ID {agent_id} not found")
        agent_info = get_agent_info(agent.id, session)

    if class_id is None:
        class_info = None
    else:
        class_data = session.exec(
            select(Classes).where(Classes.id == class_id)
        ).one_or_none()
        if not class_data:
            raise ValueError(f"Class with ID {class_id} not found")
        class_info = get_class_info(class_data.id, session)

    if seniority is None:
        seniority_info = None
    else:
        seniority_info = get_seniority_info(seniority)

    if crowdedness is None:
        crowdedness_info = None
    else:
        crowdedness_info = get_crowdedness_info(crowdedness)

    if intensity is None:
        intensity_info = None
    else:
        intensity_info = get_intensity_info(intensity)

    if document_ids is None or len(document_ids) == 0:
        document_info = None
    else:
        document_info = get_document_info(document_ids, session)

    if location is None:
        location_info = None
    else:
        location_info = get_location_info(location)

    if tod is None:
        tod_info = None
    else:
        tod_info = get_time_of_day_info(tod)

    if urgency is None:
        urgency_info = None
    else:
        urgency_info = get_urgency_info(urgency)

    # find agent with name of "Scenario"
    agent = session.exec(select(Agents).where(Agents.name == "Scenario")).one()
    if not agent:
        raise ValueError("Scenario agent not found")
    
    # getting the model from the agent's model_id
    model = session.exec(select(Models).where(Models.id == agent.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent.model_id} not found")
    
    # getting the provider from the model's provider_id
    provider = session.exec(select(Providers).where(Providers.id == model.provider_id)).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")
    
    scenario_agent = GenericAgent(
        agent_name=agent.name,
        system_prompt=agent.system_prompt,
        temperature=agent.temperature,
        model_name=model.name,
        model_provider=provider.name,
        api_key=provider.api_key,
        reasoning=agent.reasoning,
        output_type=Scenario,
    )


    agent_instance = scenario_agent.agent()

    input_items: list[TResponseInputItem | None] = [
        agent_info,
        class_info,
        document_info,
        seniority_info,
        crowdedness_info,
        intensity_info,
        location_info,
        tod_info,
        urgency_info,
    ]
    clean_input_items = [item for item in input_items if item is not None]
    logger.info(f"Input items: {clean_input_items}")

    # generate a trace id for the scenario
    trace_id = gen_trace_id()

    with trace("Scenario Agent", group_id=str(group_id), trace_id=trace_id) :
        result = await Runner.run(agent_instance, input=clean_input_items)

    # call the agents sdk to come up with a scenario description
    scenario_result = result.final_output_as(Scenario)

    return scenario_result.title, scenario_result.scenario, trace_id