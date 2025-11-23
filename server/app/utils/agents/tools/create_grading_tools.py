"""Create all grading function tools for the standard groups."""

import uuid
from collections.abc import Awaitable, Callable, Mapping, Sequence
from typing import Any

from agents import Tool

from app.utils.agents.tools.create_grading_function import create_grading_function
from app.utils.logging.db_logger import get_logger
from app.utils.agents.tools.create_summary_function import create_summary_function

logger = get_logger(__name__)


def create_grading_tools(
    standard_groups: Sequence[Mapping[str, Any]],
    standards: Sequence[Mapping[str, Any]],
    chat_id: uuid.UUID,
    emit_progress_func: Callable[[dict[str, Any]], Awaitable[None]],
) -> list[Tool]:
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
