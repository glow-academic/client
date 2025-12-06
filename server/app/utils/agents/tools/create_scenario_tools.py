"""Create all scenario generation function tools."""

import uuid
from typing import Any

from app.utils.agents.tools.create_objectives_function import create_objectives_function
from app.utils.logging.db_logger import get_logger
from app.utils.agents.tools.create_title_description_function import (
    create_title_description_function,
)
from app.utils.agents.tools.create_dynamic_document_function import (
    create_dynamic_document_function,
)

logger = get_logger(__name__)


def create_scenario_tools(
    group_id: uuid.UUID | None,
    objectives_enabled: bool = True,
    documents_enabled: bool = False,
) -> list[Any]:
    """Create all scenario generation function tools.
    
    Args:
        group_id: Optional group ID for tool coordination
        objectives_enabled: Whether to include objectives tool
        documents_enabled: Whether to include dynamic document creation tool
    """
    tools = []

    # Add title and description tool
    tools.append(create_title_description_function(group_id))
    logger.info("Created title and description tool")

    # Add objectives tool only if enabled
    if objectives_enabled:
        tools.append(create_objectives_function(group_id))
        logger.info("Created objectives tool")
    else:
        logger.info("Objectives tool skipped (objectives_enabled=False)")

    # Add dynamic document tool only if documents are enabled
    if documents_enabled:
        tools.append(create_dynamic_document_function(group_id))
        logger.info("Created dynamic document tool")
    else:
        logger.info("Dynamic document tool skipped (documents_enabled=False)")

    logger.info(f"Total scenario tools created: {len(tools)}")
    return tools
