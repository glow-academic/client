"""Create all classification function tools for parameter items."""

from typing import Any

from app.utils.agents.tools.create_classification_function import (
    create_classification_function,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def create_classification_tools(parameter_items: list[dict[str, Any]]) -> list[Any]:
    """Create classification function tools for given parameter items.

    Args:
        parameter_items: List of dicts with keys: id, name, description, value, parameter_name

    Returns:
        List of classification tools, one per parameter item
    """
    tools = []

    for item in parameter_items:
        parameter_item_id = item.get("id")
        parameter_item_name = item.get("name", "")
        parameter_item_description = item.get("description", "")

        if not parameter_item_id:
            logger.warning(f"Skipping parameter item without ID: {item}")
            continue

        tool = create_classification_function(
            parameter_item_id, parameter_item_name, parameter_item_description
        )
        tools.append(tool)
        logger.info(
            f"Created classification tool for parameter item: {parameter_item_name} (ID: {parameter_item_id})"
        )

    logger.info(f"Total classification tools created: {len(tools)}")
    return tools
