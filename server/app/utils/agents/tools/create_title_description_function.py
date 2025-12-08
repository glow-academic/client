"""Create a function tool for setting scenario title and description."""

import uuid

from agents import Tool, function_tool
from pydantic import Field

from app.main import get_scenario_storage
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key

logger = get_logger(__name__)


def create_title_description_function(
    group_id: uuid.UUID | None,
    profile_id: str | None = None,
    primary_id: str | None = None,
) -> Tool:
    """Create a function tool for setting scenario title and description.

    Args:
        group_id: Optional group ID
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
    """

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
        if not profile_id or not primary_id:
            logger.error("profile_id and primary_id required for storage")
            return "Error: Storage configuration missing"

        storage = get_scenario_storage()
        storage_key = build_storage_key(
            operation_type="scenario_generation",
            profile_id=profile_id,
            primary_id=primary_id,
        )

        await storage.set(storage_key, "title", title)
        await storage.set(storage_key, "description", scenario)
        await storage.set(storage_key, "title_description_progress", True)

        logger.info(f"✓ Set title: {title}")
        logger.info(f"✓ Set description: {scenario[:100]}...")
        return "Set title and description successfully"

    return function_tool(set_title_and_description)
