"""Create a function tool for recording the overall summary."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from agents import Tool, function_tool
from pydantic import Field

from app.main import get_grading_storage
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key

logger = get_logger(__name__)


def create_summary_function(
    chat_id: uuid.UUID,
    emit_progress_func: Callable[[dict[str, Any]], Awaitable[None]],
    profile_id: str | None = None,
) -> Tool:
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
        if not profile_id:
            return "Error: Storage configuration missing"

        storage = get_grading_storage()
        storage_key = build_storage_key(
            operation_type="grading",
            profile_id=profile_id,
            primary_id=str(chat_id),
        )

        await storage.set(storage_key, "summary", summary)
        await storage.set(storage_key, "summary_progress", True)

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
