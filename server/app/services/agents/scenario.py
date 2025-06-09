from app.db import get_session
from sqlmodel import Session
from app.models import Scenarios, Agents
from fastapi import Depends
import logging
from app.utils.agents import get_agent_info
from app.utils.classes import get_class_info
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner
from openai.types import Reasoning
from app.extensions import get_gemini
from pydantic import BaseModel
from sqlmodel import select
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


async def run_scenario_agent(
    agent_id: str,
    user_id: Optional[str],
    class_id: str,
    test_data: bool,
    session: Session = Depends(get_session),
) -> Tuple[str, str]:
    """
    This function is used to run the scenario agent.
    Returns a tuple of (scenario_id, chat_title).

    Args:
        agent_id: The ID of the agent
        user_id: The ID of the user (can be None for guest mode)
        class_id: The ID of the class
        session: The database session
        test_data: Whether to use test data
    Returns:
        A tuple of (scenario_id, chat_title).
    """

    # Get the agent to get its name for the agent
    agent = session.exec(select(Agents).where(Agents.id == agent_id)).one_or_none()
    if not agent:
        raise ValueError(f"Agent with ID {agent_id} not found")

    scenario_agent = ScenarioAgent()

    agent_info = get_agent_info(agent.name)
    class_info = get_class_info(class_id, session)

    input_items = [agent_info, class_info]

    if test_data:
        scenario_result = Scenario(
            scenario="Student is visibly agitated, approaches you quickly, you are a CS-253 GTA, and there are 10 people in line",
            title="Test Scenario",
        )
    else:
        result = await Runner.run(scenario_agent.agent(), input=input_items)

        # call the agents sdk to come up with a scenario description
        scenario_result = result.final_output_as(Scenario)

    # Create a scenario record
    scenario = Scenarios(
        name=scenario_result.title, description=scenario_result.scenario
    )
    session.add(scenario)
    session.commit()
    session.refresh(scenario)

    logger.info(f"New scenario created with ID: {scenario.id} for agent: {agent.name}")
    return str(scenario.id), scenario_result.title


class Scenario(BaseModel):
    title: str  # title
    scenario: str  # scenario


class ScenarioAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = """Your purpose is to create a scenario for a chat between a student and a GTA. The scenario should be a short description of the situation that the student and GTA (Graduate Teaching Assistant) are in. The scenario should be 1-2 sentences long. The scenario should be specific to the course and the student's question. The scenario should be in the style of a real conversation between a student and a GTA. 

        Moreover, you will be given a student profile and a course. You must design the scenario and title to be for this profile without giving it away. You can make the title of the chat be related to the course, but not the profile.

        The types of profiles are: 'aggressive', 'confused', 'happy'. The course information will be provided to you.

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
