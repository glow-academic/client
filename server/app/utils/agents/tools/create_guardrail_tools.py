"""Create all tools needed for guardrail evaluation."""

import logging
from typing import Any

from app.utils.agents.tools.create_evaluation_function import (
    create_evaluation_function,
)
from app.utils.debug_info import debug_info

logger = logging.getLogger(__name__)


def create_guardrail_tools(
    guardrail_results: dict[str, Any],
    guardrail_progress: dict[str, bool],
) -> list[Any]:
    """Create all tools needed for guardrail evaluation."""
    tools = []

    # Add evaluation tool
    tools.append(create_evaluation_function(guardrail_results, guardrail_progress))

    # Add debug_info tool (already decorated with @function_tool)
    tools.append(debug_info)

    logger.info(f"Created {len(tools)} guardrail tools")
    return tools
