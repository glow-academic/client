# utils/scenario.py

import logging
import random

from agents.items import TResponseInputItem
from app.models import Agents, Classes, Documents, Scenarios
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def get_seniority_info(seniority: str) -> TResponseInputItem:
    """
    Get the seniority information for a given seniority.
    """

    seniority_info_string = f"The student is a {seniority}."

    return {
        "role": "user",
        "content": f"The following is the seniority information: {seniority_info_string}",
    }


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


def get_location_info(location: str) -> TResponseInputItem:
    """
    Get the location information for a given location.
    """
    
    location_descriptions = {
        "haas": "HAAS basement - a quiet, focused study environment in the lower level of the HAAS building",
        "lawson": "Lawson Commons - an open, collaborative space in the Lawson building with high foot traffic",
        "dsai": "DS/AI basement - a specialized tech-focused lab environment in the basement of the Data Science/AI building"
    }
    
    location_description = location_descriptions.get(location, f"Location: {location}")

    return {
        "role": "user",
        "content": f"The following is the location information: The interaction takes place in the {location_description}.",
    }


def get_time_of_day_info(time_of_day: str) -> TResponseInputItem:
    """
    Get the time of day information for a given time.
    """
    
    time_descriptions = {
        "9AM": "9:00 AM - early morning session, students may be tired but focused",
        "10AM": "10:00 AM - mid-morning session, good energy levels",
        "11AM": "11:00 AM - late morning session, students are alert and engaged",
        "12PM": "12:00 PM - lunch time session, students may be hungry or rushed",
        "1PM": "1:00 PM - early afternoon session, post-lunch energy dip possible",
        "2PM": "2:00 PM - mid-afternoon session, good focus time",
        "3PM": "3:00 PM - late afternoon session, sustained energy needed",
        "4PM": "4:00 PM - evening session, students may be tired from the day",
        "5PM": "5:00 PM - end of day session, students eager to finish"
    }
    
    time_description = time_descriptions.get(time_of_day, f"Time: {time_of_day}")

    return {
        "role": "user",
        "content": f"The following is the time information: This interaction occurs at {time_description}.",
    }


def get_urgency_info(urgency: str) -> TResponseInputItem:
    """
    Get the urgency information for a given urgency level.
    """
    
    urgency_descriptions = {
        "hour": "The assignment is due in a few hours - this is a high-stress situation requiring immediate help",
        "day": "The assignment is due tomorrow - moderate stress, student is planning ahead",
        "days": "The assignment is due in a couple of days - low stress, plenty of time to work through problems"
    }
    
    urgency_description = urgency_descriptions.get(urgency, f"Urgency: {urgency}")

    return {
        "role": "user",
        "content": f"The following is the urgency information: {urgency_description}.",
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
        all_classes = session.exec(select(Classes)).all()
        if all_classes:
            scenario_class_id = random.choice(all_classes).id
            logger.info(f"Randomly selected class_id: {scenario_class_id}")
        else:
            scenario_class_id = None
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

    # Random location selection if location is null
    if scenario.location is None:
        location_options = ["haas", "lawson", "dsai"]
        scenario_location = random.choice(location_options)
        logger.info(f"Randomly selected location: {scenario_location}")
    else:
        scenario_location = scenario.location

    # Random time of day selection if time of day is null
    if scenario.tod is None:
        tod_options = ["9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM", "5PM"]
        scenario_tod = random.choice(tod_options)
        logger.info(f"Randomly selected time of day: {scenario_tod}")
    else:
        scenario_tod = scenario.tod

    # Random urgency selection if urgency is null
    if scenario.urgency is None:
        urgency_options = ["hour", "day", "days"]
        scenario_urgency = random.choice(urgency_options)
        logger.info(f"Randomly selected urgency: {scenario_urgency}")
    else:
        scenario_urgency = scenario.urgency

    return Scenarios(
        name=scenario.name,
        description=scenario.description,
        agent_id=scenario_agent_id,
        class_id=scenario_class_id,
        documents=scenario_documents,
        seniority=scenario_seniority,
        crowdedness=scenario_crowdedness,
        intensity=scenario_intensity,
        location=scenario_location,
        tod=scenario_tod,
        urgency=scenario_urgency,
    )