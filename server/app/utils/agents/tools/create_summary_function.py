"""Create a function tool for recording the overall summary."""

import logging
import uuid
from typing import Any

from agents import function_tool
from app.main import grading_progress, grading_results
from pydantic import Field

logger = logging.getLogger(__name__)


def create_summary_function(chat_id: uuid.UUID, emit_progress_func: Any) -> Any:
    """Create a function tool for recording the overall summary."""

    async def record_summary(
        summary: str = Field(
            description="Overall evaluation summary synthesizing main strengths and areas for improvement"
        ),
    ) -> str:
        """Record the overall evaluation summary after grading all standards.

        This should be a 2-3 sentence summary that synthesizes the TA's main strengths
        and areas for improvement based on the rubric evaluation.

        Args:
            summary: Overall summary of the evaluation

        Returns:
            Confirmation message
        """
        grading_results["summary"] = summary
        grading_progress["summary"] = True

        # Emit progress event
        await emit_progress_func(
            {
                "type": "summary_recorded",
                "chat_id": str(chat_id),
                "message": "Overall summary recorded",
                "summary_preview": summary[:150] + "..."
                if len(summary) > 150
                else summary,
            }
        )

        logger.info(f"✓ Recorded summary: {summary[:100]}...")
        return "Summary recorded successfully"

    return function_tool(record_summary)
