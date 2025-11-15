"""Create a function tool for providing a specific hint."""

import logging

from agents import Tool, function_tool
from pydantic import Field

from app.main import hint_progress, hint_results

logger = logging.getLogger(__name__)


def create_hint_function(hint_number: int) -> Tool:
    """Create a function tool for providing a specific hint."""

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
        hint_results[f"hint_{hint_number}"] = hint
        hint_progress[f"hint_{hint_number}"] = True

        logger.info(f"✓ Hint {hint_number} recorded: {hint[:80]}...")
        return f"Hint {hint_number} recorded successfully. Continue until all 3 hints are provided."

    # Set unique function name
    provide_hint.__name__ = f"provide_hint_{hint_number}"
    return function_tool(provide_hint)
