"""Create a function tool for setting scenario learning objectives."""

import logging
import uuid
from typing import Any

from agents import function_tool
from app.main import scenario_progress, scenario_results
from pydantic import Field

logger = logging.getLogger(__name__)


def create_objectives_function(group_id: uuid.UUID | None) -> Any:
    """Create a function tool for setting scenario learning objectives."""

    async def set_objectives(
        objectives: list[str] = Field(
            description="List of 1-3 specific learning objectives that GTAs should achieve in this scenario"
        ),
    ) -> str:
        """Set the learning objectives for this scenario.

        Objectives should:
        - Be specific and measurable
        - Relate to the skills needed to handle this particular scenario
        - Focus on pedagogical skills, communication, or subject matter knowledge
        - Be achievable within a single chat interaction

        Examples:
        - "Demonstrate active listening by paraphrasing the student's concerns"
        - "Break down complex concepts into understandable chunks"
        - "Manage time effectively while addressing the student's emotional state"

        Args:
            objectives: List of 1-3 learning objectives (maximum 3)

        Returns:
            Confirmation message
        """
        # Limit to maximum 3 objectives
        objectives = objectives[:3]

        if len(objectives) < 1 or len(objectives) > 3:
            logger.warning(
                f"Objectives count ({len(objectives)}) outside recommended range of 1-3"
            )

        scenario_results["objectives"] = objectives
        scenario_progress["objectives"] = True

        logger.info(f"✓ Set {len(objectives)} objectives: {objectives}")
        return f"Set {len(objectives)} learning objectives successfully"

    return function_tool(set_objectives)
