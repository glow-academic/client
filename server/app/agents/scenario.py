from app.db import get_session
from sqlmodel import Session
from app.models import Chats
from fastapi import Depends
import logging
from app.utils.profiles import get_profile_info
from app.utils.classes import get_class_info
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner
from openai.types import Reasoning
from app.extensions import get_gemini
from pydantic import BaseModel

logger = logging.getLogger(__name__)


async def run_scenario_agent(
    profile: str, user_id: str, class_id: str, session: Session = Depends(get_session)
) -> str:
    """
    This function is used to run the scenario agent.
    Returns a string of the rubric id.

    Args:
        profile: The profile of the agent
        user_id: The ID of the user
        session: The database session

    Returns:
        A string of the rubric id.
    """

    scenario_agent = ScenarioAgent()

    profile_info = get_profile_info(profile)
    class_info = get_class_info(class_id, session)

    input_items = [profile_info, class_info]

    result = await Runner.run(scenario_agent.agent(), input=input_items)

    # call the agents sdk to come up with a scenario description
    scenario = result.final_output_as(Scenario)

    scenario_description = scenario.scenario
    title = scenario.title
    # create a new chat
    # Ensure the profile value is one of the Enum values if your DB enforces it strictly.
    # For now, assuming the string matches.
    chat = Chats(
        profile=profile,
        user_id=user_id,
        scenario_description=scenario_description,
        title=title,
        class_id=class_id,
    )

    # save the chat to the database
    # session = get_session() # get_session is a generator, use Depends
    session.add(chat)
    session.commit()
    session.refresh(chat)  # Refresh to get DB generated values like ID

    logger.info(f"New chat created with ID: {chat.id} for profile: {profile}")
    return chat.id


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
