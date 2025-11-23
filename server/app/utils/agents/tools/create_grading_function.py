"""Create a function tool for grading a specific standard group."""

import uuid
from collections.abc import Awaitable, Callable, Mapping, Sequence
from typing import Any

from agents import Tool, function_tool
from pydantic import Field

from app.main import grading_progress, grading_results
from app.utils.agents.tools.create_safe_field_name import create_safe_field_name
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def create_grading_function(
    standard_group: Mapping[str, Any],
    standards: Sequence[Mapping[str, Any]],
    chat_id: uuid.UUID,
    total_standard_groups: int,
    emit_progress_func: Callable[[dict[str, Any]], Awaitable[None]],
) -> Tool:
    """Create a function tool for grading a specific standard group."""
    safe_name = create_safe_field_name(standard_group["short_name"])

    # Get standards for this group and build rating scale
    group_standards = [
        s for s in standards if s["standard_group_id"] == standard_group["id"]
    ]
    group_standards.sort(key=lambda x: x["points"], reverse=True)

    rating_scale = "\n".join(
        [
            f"  {std['points']} - {std['name']}: {std.get('description', '')}"
            for std in group_standards
        ]
    )

    full_description = (
        f"{standard_group.get('description', '')}\n\nRating Scale:\n{rating_scale}"
    )
    score_description = f"Score for {standard_group['name']} (1-5)"
    feedback_description = f"Feedback explaining the score for {standard_group['name']}"

    async def grade_standard_group(
        score: int = Field(ge=1, le=5, description=score_description),
        feedback: str = Field(default="", description=feedback_description),
    ) -> str:
        """Grade the conversation on: {standard_group_name}

        {full_description}

        Args:
            score: Integer score from 1-5 based on the rubric criteria above
            feedback: Brief feedback explaining the score with specific examples

        Returns:
            Confirmation message
        """.format(standard_group_name=standard_group["name"], full_description=full_description)
        grading_results[safe_name] = {"score": score, "feedback": feedback}
        grading_progress[safe_name] = True

        # Count completed standard groups (exclude "summary" from count)
        completed_count = sum(
            1 for k, v in grading_progress.items() if v and k != "summary"
        )

        # Emit progress event
        await emit_progress_func(
            {
                "type": "standard_graded",
                "chat_id": str(chat_id),
                "standard_group_name": standard_group["name"],
                "standard_group_short_name": standard_group["short_name"],
                "score": score,
                "feedback_preview": feedback[:100] + "..."
                if len(feedback) > 100
                else feedback,
                "completed_count": completed_count,
                "total_count": total_standard_groups,
            }
        )

        logger.info(
            f"✓ Graded {standard_group['name']}: {score}/5 - {feedback[:50]}..."
        )
        return f"Graded {standard_group['name']} with score {score}"

    grade_standard_group.__name__ = f"grade_{safe_name}"
    return function_tool(grade_standard_group)
