"""Create all scenario generation function tools."""

import logging
import uuid
from typing import Any

from app.utils.agents.tools.create_objectives_function import \
    create_objectives_function
from app.utils.agents.tools.create_title_description_function import \
    create_title_description_function

logger = logging.getLogger(__name__)


def create_scenario_tools(
    group_id: uuid.UUID | None, objectives_enabled: bool = True
) -> list[Any]:
    """Create all scenario generation function tools."""
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

    logger.info(f"Total scenario tools created: {len(tools)}")
    return tools

