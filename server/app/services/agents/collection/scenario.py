import logging
import uuid
from typing import List, Tuple

from agents import Runner, gen_trace_id, trace
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import Models, Personas, Providers, SystemAgents
from app.services.agents.generic import GenericAgent
from app.utils.document import get_document_info
from app.utils.personas import get_persona_info
from app.utils.scenario import get_parameter_item_info
from fastapi import Depends
from pydantic import BaseModel
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


class Scenario(BaseModel):
    title: str  # title
    scenario: str  # scenario


async def run_scenario_agent(
    persona_id: uuid.UUID | None = None,
    document_ids: List[uuid.UUID] | None = None,
    parameter_item_ids: List[uuid.UUID] | None = None,
    group_id: uuid.UUID | None = None,
    session: Session = Depends(get_session),
) -> Tuple[str, str, str]:
    """
    This function is used to run the scenario agent.

    Args:
        persona_id: The ID of the persona
        document_ids: The IDs of the documents
        parameter_item_ids: The IDs of the parameter items
        group_id: The ID of the group
        session: The database session
    Returns:
        A tuple of (scenario_id, chat_title, trace_id).
    """

    # Get the agent to get its name for the agent
    if persona_id is None:
        persona_info = None
    else:
        persona = session.exec(select(Personas).where(Personas.id == persona_id)).one_or_none()
        if not persona:
            raise ValueError(f"Persona with ID {persona_id} not found")
        persona_info = get_persona_info(persona.id, session)

    if document_ids is None or len(document_ids) == 0:
        document_info = None
    else:
        document_info = get_document_info(document_ids, session)


    if parameter_item_ids is None or len(parameter_item_ids) == 0:
        parameter_item_info = None
    else:
        parameter_item_info = get_parameter_item_info(parameter_item_ids, session)

    # find agent with name of "Scenario"
    scenario_agent = session.exec(select(SystemAgents).where(SystemAgents.name == "Scenario")).one()
    if not scenario_agent:
        raise ValueError("Scenario agent not found")

    # getting the model from the agent's model_id
    model = session.exec(select(Models).where(Models.id == scenario_agent.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {scenario_agent.model_id} not found")

    # getting the provider from the model's provider_id
    provider = session.exec(
        select(Providers).where(Providers.id == model.provider_id)
    ).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    scenario_agent_generic = GenericAgent(
        agent_name=scenario_agent.name,
        system_prompt=scenario_agent.system_prompt,
        temperature=scenario_agent.temperature,
        model_name=model.name,
        model_provider=provider.name,
        api_key=provider.api_key,
        reasoning=scenario_agent.reasoning,
        output_type=Scenario
    )

    agent_instance = scenario_agent_generic.agent()

    input_items: list[TResponseInputItem | None] = [
        persona_info,
        document_info,
        parameter_item_info,
    ]
    clean_input_items = [item for item in input_items if item is not None]
    logger.info(f"Input items: {clean_input_items}")

    # generate a trace id for the scenario
    trace_id = gen_trace_id()

    with trace("Scenario Agent", group_id=str(group_id), trace_id=trace_id):
        result = await Runner.run(agent_instance, input=clean_input_items)

    # call the agents sdk to come up with a scenario description
    scenario_result = result.final_output_as(Scenario)

    return scenario_result.title, scenario_result.scenario, trace_id
