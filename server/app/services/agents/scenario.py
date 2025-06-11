from app.db import get_session
from sqlmodel import Session
from app.models import Agents, Classes
from fastapi import Depends
import logging
from app.utils.agents import get_agent_info
from app.utils.classes import get_class_info
from app.utils.scenario import get_seniority_info, get_crowdedness_info, get_intensity_info
from app.utils.document import get_document_info
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner
from openai.types import Reasoning
from app.extensions import get_gemini
from pydantic import BaseModel
from sqlmodel import select
from typing import Tuple, List

logger = logging.getLogger(__name__)


async def run_scenario_agent(
    agent_id: str | None = None,
    class_id: str | None = None,
    document_ids: List[str] | None = None,
    seniority: str | None = None,
    crowdedness: int | None = None,
    intensity: int | None = None,
    session: Session = Depends(get_session),
) -> Tuple[str, str]:
    """
    This function is used to run the scenario agent.

    Args:
        agent_id: The ID of the agent
        user_id: The ID of the user (can be None for guest mode)
        class_id: The ID of the class
        session: The database session
    Returns:
        A tuple of (scenario_id, chat_title).
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
        class_data = session.exec(select(Classes).where(Classes.id == class_id)).one_or_none()
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

    scenario_agent = ScenarioAgent()

    input_items = [agent_info, class_info, document_info, seniority_info, crowdedness_info, intensity_info]
    input_items = [item for item in input_items if item is not None]
    logger.info(f"Input items: {input_items}")

    result = await Runner.run(scenario_agent.agent(), input=input_items)

    # call the agents sdk to come up with a scenario description
    scenario_result = result.final_output_as(Scenario)

    return scenario_result.title, scenario_result.scenario


class Scenario(BaseModel):
    title: str  # title
    scenario: str  # scenario


class ScenarioAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = """Your purpose is to create a scenario for a chat between a student and a GTA. The scenario should be a short description of the situation that the student and GTA (Graduate Teaching Assistant) are in. The scenario should be 1-2 sentences long. The scenario should be specific to the content that you will recieve. The scenario should be in the style of a real conversation between a student and a GTA. 

        Moreover, you will be given a student agent, a course, a list of documents, a seniority, a crowdedness, and an intensity. You must design the scenario and title to be for this agent, course, documents, seniority, crowdedness, and intensity without giving it away. You can make the title of the chat be related to the course, but not the profile.

        Try to always give a sense of how many other people are in line, to test the ability of the GTA to manage time.
        
        You can also create a chat title to go along with the scenario. Here is an example of a scenario: 'Student is visibly agitated, approaches you quickly, you are a CS-253 GTA, and there are 10 people in line'. Here is an example of a chat title: 'Induction Homework Help'. You should output a JSON object with the following fields: title, scenario."""

    def agent(self):
        return Agent(
            name="Scenario Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                reasoning=Reasoning(effort="low"),
            ),
            output_type=Scenario,
        )
