"""Create a function tool for providing a specific hint."""


from agents import Tool, function_tool
from pydantic import Field

from app.utils.logging.db_logger import get_logger
from app.main import get_hint_storage
from app.utils.storage.request_storage import build_storage_key

logger = get_logger(__name__)


def create_hint_function(
    hint_number: int,
    profile_id: str | None = None,
    primary_id: str | None = None,
) -> Tool:
    """Create a function tool for providing a specific hint.
    
    Args:
        hint_number: Hint number (1, 2, or 3)
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (chat_id, etc.)
    """

    async def provide_hint(
        hint: str = Field(
            description=(
                f"A concise, practical teaching strategy or communication tip for the GTA. "
                f"This is hint #{hint_number} of 3 required hints. "
                f"Make it distinct from the other hints and focused on a different aspect "
                f"of helping the student (e.g., content explanation, emotional support, pedagogical approach)."
            )
        ),
    ) -> str:
        """Provide a strategic hint for the GTA.

        This hint should help the GTA better address the student's needs or communication style.
        Focus on teaching strategies, clarification techniques, empathy, or encouragement.
        Each hint should cover a different aspect of the interaction.

        Args:
            hint: Practical, actionable hint for the GTA (distinct from other hints)

        Returns:
            Confirmation message indicating the hint was recorded
        """
        if not profile_id or not primary_id:
            return "Error: Storage configuration missing"
        
        storage = get_hint_storage()
        storage_key = build_storage_key(
            operation_type="hint_generation",
            profile_id=profile_id,
            primary_id=primary_id,
        )
        
        await storage.set(storage_key, f"hint_{hint_number}", hint)
        await storage.set(storage_key, f"hint_{hint_number}_progress", True)

        logger.info(f"✓ Hint {hint_number} recorded: {hint[:80]}...")
        return f"Hint {hint_number} recorded successfully. Continue until all 3 hints are provided."

    # Set unique function name
    provide_hint.__name__ = f"provide_hint_{hint_number}"
    return function_tool(provide_hint)
