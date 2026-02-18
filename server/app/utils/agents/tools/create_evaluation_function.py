"""Create a function tool for evaluating if a response is proper."""

import logging
from typing import Any

from agents import Tool, function_tool
from pydantic import Field

logger = logging.getLogger(__name__)


def create_evaluation_function(
    guardrail_results: dict[str, Any],
    guardrail_progress: dict[str, bool],
) -> Tool:
    """Create a function tool for evaluating if a response is proper."""

    async def evaluate_response(
        proper: bool = Field(
            description="Whether the response adheres to role expectations and is natural"
        ),
        reason: str = Field(
            description="Clear explanation for the evaluation decision"
        ),
    ) -> str:
        """Evaluate if the response is proper and provide reasoning.

        Args:
            proper: True if the response is appropriate, False if it violates guidelines
            reason: Detailed explanation of the evaluation

        Returns:
            Confirmation message
        """
        guardrail_results["proper"] = proper
        guardrail_results["reason"] = reason
        guardrail_progress["evaluation"] = True

        logger.info(f"✓ Evaluation complete: proper={proper}, reason={reason[:100]}...")
        return f"Evaluation recorded: {'Proper' if proper else 'Improper'}"

    return function_tool(evaluate_response)
