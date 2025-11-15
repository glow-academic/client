"""Create all tools needed for guardrail evaluation."""

import logging
from typing import Any

from app.utils.debug_info import debug_info
from app.utils.agents.tools.create_evaluation_function import (
    create_evaluation_function,
)

logger = logging.getLogger(__name__)


def create_guardrail_tools() -> list[Any]:
    """Create all tools needed for guardrail evaluation."""
    tools = []

    # Add evaluation tool
    tools.append(create_evaluation_function())

    # Add debug_info tool (already decorated with @function_tool)
    tools.append(debug_info)

    logger.info(f"Created {len(tools)} guardrail tools")
    return tools
