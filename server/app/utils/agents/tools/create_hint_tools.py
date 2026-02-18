"""Create all tools needed for hint generation."""

import logging
from typing import Any

from agents import Tool

from app.utils.agents.tools.create_hint_function import create_hint_function
from app.utils.debug_info import debug_info

logger = logging.getLogger(__name__)


def create_hint_tools(
    hint_results: dict[str, Any],
    hint_progress: dict[str, bool],
) -> list[Tool]:
    """Create all tools needed for hint generation."""
    tools = []

    # Create three separate hint tools
    for i in range(1, 4):  # 1, 2, 3
        tools.append(create_hint_function(i, hint_results, hint_progress))

    # Add debug_info tool
    tools.append(debug_info)

    logger.info(f"Created {len(tools)} hint tools (3 hints + debug_info)")
    return tools
