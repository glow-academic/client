# utils/scenario.py

import logging
import random
import uuid

from agents.items import TResponseInputItem
from app.models import (Agents, Documents, ScenarioClasses, ScenarioDeadlines,
                        ScenarioLocations, Scenarios, ScenarioTimes)
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def get_crowdedness_info(crowdedness: int) -> TResponseInputItem:
    """
    Get the crowdedness information for a given crowdedness.
    """

    crowdedness_info_string = f"The scenario has a {crowdedness} level of crowdedness."

    return {
        "role": "user",
        "content": f"The following is the crowdedness information, on a scale of 1 to 10 (1 being the least crowded and 10 being the most crowded): {crowdedness_info_string}",
    }


def get_intensity_info(intensity: int) -> TResponseInputItem:
    """
    Get the intensity information for a given intensity.
    """

    intensity_info_string = f"The scenario has a {intensity} level of intensity."

    return {
        "role": "user",
        "content": f"The following is the intensity information, on a scale of 1 to 10 (1 being the least intense and 10 being the most intense): {intensity_info_string}",
    }


def get_class_info(class_id: uuid.UUID, session: Session) -> TResponseInputItem:
    """
    Get the class information for a given class id.
    """

    class_info = session.exec(select(ScenarioClasses).where(ScenarioClasses.id == class_id)).first()
    if not class_info:
        raise ValueError(f"Class not found for class {class_id}")

    return {
        "role": "user",
        "content": f"The following is the class information: {class_info.name} (Class Code: {class_info.class_code}) - {class_info.description}",
    }

def get_location_info(location_id: uuid.UUID, session: Session) -> TResponseInputItem:
    """
    Get the location information for a given location.
    """

    location = session.exec(select(ScenarioLocations).where(ScenarioLocations.id == location_id)).one()

    return {
        "role": "user",
        "content": f"The following is the location information: The interaction takes place in the {location.name} - {location.description}.",
    }


def get_time_info(time_id: uuid.UUID, session: Session) -> TResponseInputItem:
    """
    Get the time of day information for a given time.
    """

    time = session.exec(select(ScenarioTimes).where(ScenarioTimes.id == time_id)).one()

    time_description = time.time_of_day.strftime("%H:%M") + " - " + time.description

    return {
        "role": "user",
        "content": f"The following is the time information: This interaction occurs at {time_description}.",
    }


def get_deadline_info(deadline_id: uuid.UUID, session: Session) -> TResponseInputItem:
    """
    Get the deadline information for a given deadline.
    """

    deadline = session.exec(
        select(ScenarioDeadlines).where(ScenarioDeadlines.id == deadline_id)
    ).one()

    deadline_description = deadline.deadline + " - " + deadline.description

    return {
        "role": "user",
        "content": f"The following is the deadline information: {deadline_description}.",
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
            scenario_agent_id = None
    else:
        scenario_agent_id = scenario.agent_id

    # Random class selection if class_id is null
    if scenario.class_id is None:
        all_classes = session.exec(select(ScenarioClasses)).all()
        if all_classes:
            scenario_class_id = random.choice(all_classes).id
            logger.info(f"Randomly selected class_id: {scenario_class_id}")
        else:
            scenario_class_id = None
    else:
        scenario_class_id = scenario.class_id

    # Random document selection if documents is null
    if scenario.document_ids is None:
        all_documents = session.exec(select(Documents)).all()
        if all_documents:
            # Randomly select 0-3 documents
            num_docs = random.randint(0, min(3, len(all_documents)))
            if num_docs > 0:
                selected_docs = random.sample(all_documents, num_docs)
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
        scenario_documents = scenario.document_ids

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


    # Random class selection if class is null
    if scenario.class_id is None:
        all_classes = session.exec(select(ScenarioClasses)).all()
        if all_classes:
            scenario_class_id = random.choice(all_classes).id
            logger.info(f"Randomly selected class_id: {scenario_class_id}")
        else:
            scenario_class_id = None
    else:
        scenario_class_id = scenario.class_id

    # Random location selection if location is null
    if scenario.location_id is None:
        all_locations = session.exec(select(ScenarioLocations)).all()
        if all_locations:
            scenario_location_id = random.choice(all_locations).id
            logger.info(f"Randomly selected location_id: {scenario_location_id}")
        else:
            scenario_location_id = None
    else:
        scenario_location_id = scenario.location_id

    # Random time of day selection if time of day is null
    if scenario.time_id is None:
        all_times = session.exec(select(ScenarioTimes)).all()
        if all_times:
            scenario_time_id = random.choice(all_times).id
            logger.info(f"Randomly selected time_id: {scenario_time_id}")
        else:
            scenario_time_id = None
    else:
        scenario_time_id = scenario.time_id

    # Random urgency selection if urgency is null
    if scenario.deadline_id is None:
        all_deadlines = session.exec(select(ScenarioDeadlines)).all()
        if all_deadlines:
            scenario_deadline_id = random.choice(all_deadlines).id
            logger.info(f"Randomly selected deadline_id: {scenario_deadline_id}")
        else:
            scenario_deadline_id = None
        logger.info(f"Randomly selected deadline_id: {scenario_deadline_id}")
    else:
        scenario_deadline_id = scenario.deadline_id

    return Scenarios(
        name=scenario.name,
        description=scenario.description,
        agent_id=scenario_agent_id,
        class_id=scenario_class_id,
        documents=scenario_documents,
        crowdedness=scenario_crowdedness,
        intensity=scenario_intensity,
        location_id=scenario_location_id,
        time_id=scenario_time_id,
        deadline_id=scenario_deadline_id,
        generated=True,
        parent_id=scenario.id,  # since we are creating a new scenario, we need to set the parent_id to the original scenario
    )
