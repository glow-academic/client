"""Create all grading function tools for the standard groups."""

import logging
import uuid
from typing import Any

from app.utils.agents.tools.create_grading_function import create_grading_function
from app.utils.agents.tools.create_summary_function import create_summary_function

logger = logging.getLogger(__name__)


def create_grading_tools(
    standard_groups: list[Any],
    standards: list[Any],
    chat_id: uuid.UUID,
    emit_progress_func: Any,
) -> list[Any]:
    """Create all grading function tools for the standard groups."""
    tools = []
    total_standard_groups = len(standard_groups)

    for group in standard_groups:
        tool = create_grading_function(
            group, standards, chat_id, total_standard_groups, emit_progress_func
        )
        tools.append(tool)
        logger.info(f"Created grading tool for: {group['name']}")

    # Add summary tool
    tools.append(create_summary_function(chat_id, emit_progress_func))
    logger.info("Created summary tool")

    logger.info(f"Total grading tools created: {len(tools)}")
    return tools

