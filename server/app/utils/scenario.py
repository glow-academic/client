# utils/scenario.py

import logging
import random

from app.models import Agents, Classes, Documents, Scenarios
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def get_seniority_info(seniority: str) -> dict[str, str]:
    """
    Get the seniority information for a given seniority.
    """

    seniority_info_string = f"The student is a {seniority}."

    return {
        "role": "assistant",
        "content": f"The following is the seniority information: {seniority_info_string}",
    }


def get_crowdedness_info(crowdedness: int) -> dict[str, str]:
    """
    Get the crowdedness information for a given crowdedness.
    """

    crowdedness_info_string = f"The scenario has a {crowdedness} level of crowdedness."

    return {
        "role": "assistant",
        "content": f"The following is the crowdedness information, on a scale of 1 to 10 (1 being the least crowded and 10 being the most crowded): {crowdedness_info_string}",
    }


def get_intensity_info(intensity: int) -> dict[str, str]:
    """
    Get the intensity information for a given intensity.
    """

    intensity_info_string = f"The scenario has a {intensity} level of intensity."

    return {
        "role": "assistant",
        "content": f"The following is the intensity information, on a scale of 1 to 10 (1 being the least intense and 10 being the most intense): {intensity_info_string}",
    }


async def randomly_fill_scenario_attributes(
    scenario: Scenarios, session: Session
) -> Scenarios:
    """
    Randomly fill null attributes of a scenario with available options from the database.

    Args:
        scenario: The scenario object with potentially null attributes
        session: Database session

    Returns:
        Updated scenario object with randomly selected values for null attributes
    """
    # Random agent selection if agent_id is null
    if scenario.agent_id is None:
        all_agents = session.exec(select(Agents)).all()
        if all_agents:
            scenario_agent_id = random.choice(all_agents).id
            logger.info(f"Randomly selected agent_id: {scenario_agent_id}")
    else:
        scenario_agent_id = scenario.agent_id

    # Random class selection if class_id is null
    if scenario.class_id is None:
        all_classes = session.exec(select(Classes)).all()
        if all_classes:
            scenario_class_id = random.choice(all_classes).id
            logger.info(f"Randomly selected class_id: {scenario_class_id}")
    else:
        scenario_class_id = scenario.class_id

    # Random document selection if documents is null
    if scenario.documents is None:
        # Get all documents, optionally filtered by class if we have one
        if scenario_class_id:
            class_documents = session.exec(
                select(Documents).where(Documents.class_id == scenario_class_id)
            ).all()
        else:
            class_documents = session.exec(select(Documents)).all()

        if class_documents:
            # Randomly select 0-3 documents
            num_docs = random.randint(0, min(3, len(class_documents)))
            if num_docs > 0:
                selected_docs = random.sample(class_documents, num_docs)
                scenario_documents = [doc.id for doc in selected_docs]
                logger.info(
                    f"Randomly selected {num_docs} documents: {scenario_documents}"
                )
            else:
                scenario_documents = []
                logger.info("Randomly selected 0 documents (empty list)")
        else:
            scenario_documents = []
            logger.info("No documents found")
    else:
        scenario_documents = scenario.documents

    # Random seniority selection if seniority is null
    if scenario.seniority is None:
        seniority_options = ["freshman", "sophomore", "junior", "senior"]
        scenario_seniority = random.choice(seniority_options)
        logger.info(f"Randomly selected seniority: {scenario_seniority}")
    else:
        scenario_seniority = scenario.seniority

    # Random crowdedness selection if crowdedness is null (1-10 scale)
    if scenario.crowdedness is None:
        scenario_crowdedness = random.randint(1, 10)
        logger.info(f"Randomly selected crowdedness: {scenario_crowdedness}")
    else:
        scenario_crowdedness = scenario.crowdedness

    # Random intensity selection if intensity is null (1-10 scale)
    if scenario.intensity is None:
        scenario_intensity = random.randint(1, 10)
        logger.info(f"Randomly selected intensity: {scenario_intensity}")
    else:
        scenario_intensity = scenario.intensity

    return Scenarios(
        name=scenario.name,
        description=scenario.description,
        agent_id=scenario_agent_id,
        class_id=scenario_class_id,
        documents=scenario_documents,
        seniority=scenario_seniority,
        crowdedness=scenario_crowdedness,
        intensity=scenario_intensity,
    )


