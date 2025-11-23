"""Create all tools needed for hint generation."""


from agents import Tool

from app.utils.agents.tools.create_hint_function import create_hint_function
from app.utils.logging.db_logger import get_logger
from app.utils.debug_info import debug_info

logger = get_logger(__name__)


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
