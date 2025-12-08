"""Create all tools needed for hint generation."""

from agents import Tool

from app.utils.agents.tools.create_hint_function import create_hint_function
from app.utils.debug_info import debug_info
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def create_hint_tools(
    profile_id: str | None = None,
    primary_id: str | None = None,
) -> list[Tool]:
    """Create all tools needed for hint generation.

    Args:
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (chat_id, etc.)
    """
    tools = []

    # Create three separate hint tools
    for i in range(1, 4):  # 1, 2, 3
        tools.append(
            create_hint_function(i, profile_id=profile_id, primary_id=primary_id)
        )

    # Add debug_info tool
    tools.append(debug_info)

    logger.info(f"Created {len(tools)} hint tools (3 hints + debug_info)")
    return tools
