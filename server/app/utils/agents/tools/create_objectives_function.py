"""Create a function tool for setting scenario learning objectives."""

import uuid

from agents import Tool, function_tool
from app.main import get_scenario_storage
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key
from pydantic import Field

logger = get_logger(__name__)


def create_objectives_function(
    group_id: uuid.UUID | None,
    profile_id: str | None = None,
    primary_id: str | None = None,
) -> Tool:
    """Create a function tool for setting scenario learning objectives.

    Args:
        group_id: Optional group ID
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (trace_id, scenario_id, etc.)
    """

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
        if not profile_id or not primary_id:
            logger.error("profile_id and primary_id required for storage")
            return "Error: Storage configuration missing"

        # Limit to maximum 3 objectives
        objectives = objectives[:3]

        if len(objectives) < 1 or len(objectives) > 3:
            logger.warning(
                f"Objectives count ({len(objectives)}) outside recommended range of 1-3"
            )

        storage = get_scenario_storage()
        storage_key = build_storage_key(
            operation_type="scenario_generation",
            profile_id=profile_id,
            primary_id=primary_id,
        )

        await storage.set(storage_key, "objectives", objectives)
        await storage.set(storage_key, "objectives_progress", True)

        logger.info(f"✓ Set {len(objectives)} objectives: {objectives}")
        return f"Set {len(objectives)} learning objectives successfully"

    return function_tool(set_objectives)
