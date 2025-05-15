from app.db import get_session
from sqlmodel import Session
from app.models import Chats, Rubrics
from fastapi import Depends
import random
import logging

logger = logging.getLogger(__name__)


async def run_evaluate_agent(
    chat_id: str, session: Session = Depends(get_session)
) -> str:
    """
    This function is used to run the evaluate agent.
    Returns a string of the rubric id.

    Args:
        chat_id: The ID of the chat session

    Returns:
        A string of the rubric id.
    """

    chat = session.get(Chats, chat_id)  # Use session.get for primary key lookup
    chat.completed = True

    adaptability = random.randint(1, 4)
    active_listening = random.randint(1, 4)
    empathy = random.randint(1, 4)
    communication = random.randint(1, 4)
    nonverbal = random.randint(1, 4)
    problem_solving = random.randint(1, 4)
    resource_utilization = random.randint(1, 4)
    time_management = random.randint(1, 4)
    score = (
        adaptability
        + active_listening
        + empathy
        + communication
        + nonverbal
        + problem_solving
        + resource_utilization
        + time_management
    )
    passed = score >= 23  # more than 25 on the rubric

    # time take is random between 20 and 60 seconds
    time_taken = random.randint(20, 60)

    # create a rubric
    rubric = Rubrics(
        chat_id=chat_id,
        passed=passed,
        score=score,
        time_taken=time_taken,
        adaptability=adaptability,
        active_listening=active_listening,
        empathy=empathy,
        communication=communication,
        nonverbal=nonverbal,
        problem_solving=problem_solving,
        resource_utilization=resource_utilization,
        time_management=time_management,
    )

    session.add(rubric)

    chat.completed = True
    session.add(chat)

    session.commit()
    session.refresh(chat)

    logger.info(f"Rubric created with ID: {rubric.id}")
    return rubric.id
