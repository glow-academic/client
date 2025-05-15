from app.db import get_session
from sqlmodel import Session
from app.models import Chats
from fastapi import Depends
import logging
from app.utils.profiles import scenario_descriptions, chat_titles

logger = logging.getLogger(__name__)


async def run_scenario_agent(
    profile: str, user_id: str, session: Session = Depends(get_session)
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

    # call the agents sdk to come up with a scenario description
    scenario = scenario_descriptions[profile]
    title = chat_titles[profile]
    # create a new chat
    # Ensure the profile value is one of the Enum values if your DB enforces it strictly.
    # For now, assuming the string matches.
    chat = Chats(
        profile=profile, user_id=user_id, scenario_description=scenario, title=title
    )

    # save the chat to the database
    # session = get_session() # get_session is a generator, use Depends
    session.add(chat)
    session.commit()
    session.refresh(chat)  # Refresh to get DB generated values like ID

    logger.info(f"New chat created with ID: {chat.id} for profile: {profile}")
    return chat.id
