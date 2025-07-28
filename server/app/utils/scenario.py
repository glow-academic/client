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


def get_parameter_item_info(
    parameter_item_ids: List[uuid.UUID], session: Session
) -> TResponseInputItem:
    """
    Get the parameter item information for a given parameter item ids.
    """
    # Join ParameterItems with Parameters to get parameter name and description
    parameter_items_with_params = session.exec(
        select(ParameterItems, Parameters)
        .join(Parameters, ParameterItems.parameter_id == Parameters.id)
        .where(ParameterItems.id.in_(parameter_item_ids))
    ).all()

    if not parameter_items_with_params:
        return {
            "role": "user",
            "content": "No parameter items found.",
        }

    # Format each parameter item using the template
    formatted_items = []
    for param_item, param in parameter_items_with_params:
        formatted_item = f"This is the {param.name} ({param.description}) for this chat: {param_item.name}. Description: {param_item.description}"
        formatted_items.append(formatted_item)

    content = "The following is the parameter item information:\n" + "\n".join(
        formatted_items
    )

    return {
        "role": "user",
        "content": content,
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
    if scenario.persona_id is None:
        # Only select from active personas
        active_personas = session.exec(
            select(Personas).where(Personas.active)
        ).all()
        if active_personas:
            scenario_persona_id = random.choice(active_personas).id
            logger.info(f"Randomly selected persona_id: {scenario_persona_id}")
        else:
            scenario_persona_id = None
            logger.info("No active personas found")
    else:
        scenario_persona_id = scenario.persona_id

    # Random document selection if documents is null
    if scenario.document_ids is None:
        # Only select from active documents
        active_documents = session.exec(
            select(Documents).where(Documents.active)
        ).all()
        if active_documents:
            # Randomly select 0-3 documents
            num_docs = random.randint(0, min(3, len(active_documents)))
            if num_docs > 0:
                selected_docs = random.sample(active_documents, num_docs)
                scenario_documents = [doc.id for doc in selected_docs]
                logger.info(
                    f"Randomly selected {num_docs} active documents: {scenario_documents}"
                )
            else:
                scenario_documents = []
                logger.info("Randomly selected 0 documents (empty list)")
        else:
            scenario_documents = []
            logger.info("No active documents found")
    else:
        scenario_documents = scenario.document_ids

    # Random parameter item selection if parameter_item_ids is null or empty
    if scenario.parameter_item_ids is None or len(scenario.parameter_item_ids) == 0:
        # Get all active parameters
        active_parameters = session.exec(
            select(Parameters).where(Parameters.active)
        ).all()

        if active_parameters:
            # For each active parameter, randomly select one parameter item
            scenario_parameter_item_ids = []
            for param in active_parameters:
                # Get all parameter items for this parameter
                param_items = session.exec(
                    select(ParameterItems).where(
                        ParameterItems.parameter_id == param.id
                    )
                ).all()

                if param_items:
                    # Randomly select one parameter item from this parameter
                    selected_item = random.choice(param_items)
                    scenario_parameter_item_ids.append(selected_item.id)
                    logger.info(
                        f"Selected parameter item for {param.name}: {selected_item.name}"
                    )

            logger.info(
                f"Randomly selected {len(scenario_parameter_item_ids)} parameter items (one per active parameter): {scenario_parameter_item_ids}"
            )
        else:
            scenario_parameter_item_ids = []
            logger.info("No active parameters found")
    else:
        # If parameter_item_ids are provided, ensure we only have one per active parameter
        # Get all active parameters
        active_parameters = session.exec(
            select(Parameters).where(Parameters.active)
        ).all()
        active_param_ids = {param.id for param in active_parameters}

        # Get all parameter items for the provided IDs
        all_param_items = session.exec(
            select(ParameterItems).where(
                ParameterItems.id.in_(scenario.parameter_item_ids)
            )
        ).all()

        # Group parameter items by their parameter_id
        param_items_by_param: dict[uuid.UUID, list[ParameterItems]] = {}
        for item in all_param_items:
            if item.parameter_id not in param_items_by_param:
                param_items_by_param[item.parameter_id] = []
            param_items_by_param[item.parameter_id].append(item)

        # For each active parameter, randomly select one parameter item if multiple exist
        scenario_parameter_item_ids = []
        for param_id in active_param_ids:
            if param_id in param_items_by_param:
                items = param_items_by_param[param_id]
                if len(items) > 1:
                    # Multiple items for this parameter, randomly select one
                    selected_item = random.choice(items)
                    scenario_parameter_item_ids.append(selected_item.id)
                    logger.info(
                        f"Multiple items for parameter {param_id}, selected: {selected_item.name}"
                    )
                else:
                    # Only one item for this parameter
                    scenario_parameter_item_ids.append(items[0].id)
                    logger.info(
                        f"Single item for parameter {param_id}: {items[0].name}"
                    )

        logger.info(
            f"Filtered to {len(scenario_parameter_item_ids)} parameter items (one per active parameter): {scenario_parameter_item_ids}"
        )

    return Scenarios(
        name=scenario.name,
        description=scenario.description,
        persona_id=scenario_persona_id,
        document_ids=scenario_documents,
        parameter_item_ids=scenario_parameter_item_ids,
        generated=True,
        parent_id=scenario.id,  # since we are creating a new scenario, we need to set the parent_id to the original scenario
    )
