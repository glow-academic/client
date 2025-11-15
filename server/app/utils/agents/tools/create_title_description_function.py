"""Create a function tool for setting scenario title and description."""

import logging
import uuid
from typing import Any

from agents import function_tool
from app.main import scenario_progress, scenario_results
from pydantic import Field

logger = logging.getLogger(__name__)


def create_title_description_function(group_id: uuid.UUID | None) -> Any:
    """Create a function tool for setting scenario title and description."""

    async def set_title_and_description(
        title: str = Field(
            description="Short, descriptive title for the scenario (5-10 words)"
        ),
        scenario: str = Field(
            description="Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it"
        ),
    ) -> str:
        """Set the title and description for the scenario.

        The title should be concise and descriptive (5-10 words).
        The scenario description must be exactly 1-2 sentences and should:
        - Subtly show the student's persona without stating it directly
        - Incorporate environmental parameters (crowdedness, intensity, time, deadline, location)
        - Focus on the course topic from the documents
        - Build a scene that shows, not tells

        Args:
            title: Short descriptive title
            scenario: 1-2 sentence scenario description

        Returns:
            Confirmation message
        """
        scenario_results["title"] = title
        scenario_results["description"] = scenario
        scenario_progress["title_description"] = True

        logger.info(f"✓ Set title: {title}")
        logger.info(f"✓ Set description: {scenario[:100]}...")
        return "Set title and description successfully"

    return function_tool(set_title_and_description)

