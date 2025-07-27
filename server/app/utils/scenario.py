# utils/scenario.py

import logging
import random
import uuid
from typing import List

from agents.items import TResponseInputItem
from app.models import (Documents, ParameterItems, Parameters, Personas,
                        Scenarios)
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def get_parameter_item_info(parameter_item_ids: List[uuid.UUID], session: Session) -> TResponseInputItem:
    """
    Get the parameter item information for a given parameter item ids.
    """
    parameter_items = session.exec(select(ParameterItems).where(ParameterItems.id.in_(parameter_item_ids))).all()
    return {
        "role": "user",
        "content": f"The following is the parameter item information: {parameter_items}",
    }


def construct_scenario_description(scenario: Scenarios, session: Session) -> str:
    """
    Construct a comprehensive scenario description based on all parameter items and their associated parameters.
    
    Args:
        scenario: The scenario object
        session: Database session
        
    Returns:
        Enhanced description with parameter context
    """
    base_description = scenario.description or ""
    
    if not scenario.parameter_item_ids:
        return base_description
    
    # Get all parameter items
    parameter_items = session.exec(
        select(ParameterItems).where(ParameterItems.id.in_(scenario.parameter_item_ids))
    ).all()
    
    if not parameter_items:
        return base_description
    
    # Get the associated parameters
    parameter_ids = [item.parameter_id for item in parameter_items]
    parameters = session.exec(
        select(Parameters).where(Parameters.id.in_(parameter_ids))
    ).all()
    
    # Create a mapping of parameter_id to parameter
    param_map = {param.id: param for param in parameters}
    
    # Build parameter context description
    param_context = []
    for param_item in parameter_items:
        param = param_map.get(param_item.parameter_id)
        if param:
            param_context.append(f"{param.name}: {param_item.name} ({param_item.value})")
    
    # Combine base description with parameter context
    if param_context:
        enhanced_description = f"{base_description}\n\nContext Parameters:\n" + "\n".join(f"- {context}" for context in param_context)
        return enhanced_description
    
    return base_description


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
    if scenario.persona_id is None:
        all_personas = session.exec(select(Personas)).all()
        if all_personas:
            scenario_persona_id = random.choice(all_personas).id
            logger.info(f"Randomly selected persona_id: {scenario_persona_id}")
        else:
            scenario_persona_id = None
    else:
        scenario_persona_id = scenario.persona_id

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

    # Random parameter item selection if parameter_item_ids is null
    if scenario.parameter_item_ids is None:
        # Get all parameter items
        all_parameter_items = session.exec(select(ParameterItems)).all()
        if all_parameter_items:
            # Randomly select 3-5 parameter items
            num_params = random.randint(3, min(5, len(all_parameter_items)))
            selected_param_items = random.sample(all_parameter_items, num_params)
            scenario_parameter_item_ids = [item.id for item in selected_param_items]
            logger.info(f"Randomly selected {len(scenario_parameter_item_ids)} parameter items: {scenario_parameter_item_ids}")
        else:
            scenario_parameter_item_ids = []
            logger.info("No parameter items found")
    else:
        scenario_parameter_item_ids = scenario.parameter_item_ids

    # Construct enhanced description with parameter context
    enhanced_description = construct_scenario_description(
        Scenarios(
            name=scenario.name,
            description=scenario.description,
            parameter_item_ids=scenario_parameter_item_ids
        ), 
        session
    )

    return Scenarios(
        name=scenario.name,
        description=enhanced_description,
        persona_id=scenario_persona_id,
        document_ids=scenario_documents,
        parameter_item_ids=scenario_parameter_item_ids,
        generated=True,
        parent_id=scenario.id,  # since we are creating a new scenario, we need to set the parent_id to the original scenario
    )
