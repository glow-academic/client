"""Create all tools needed for hint generation."""

import logging

from agents import Tool

from app.utils.debug_info import debug_info
from app.utils.agents.tools.create_hint_function import create_hint_function

logger = logging.getLogger(__name__)


def create_hint_tools() -> list[Tool]:
    """Create all tools needed for hint generation."""
    tools = []

    # Create three separate hint tools
    for i in range(1, 4):  # 1, 2, 3
        tools.append(create_hint_function(i))

    # Add debug_info tool
    tools.append(debug_info)

    logger.info(f"Created {len(tools)} hint tools (3 hints + debug_info)")
    return tools

