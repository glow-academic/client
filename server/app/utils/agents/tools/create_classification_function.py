"""Create a function tool for classifying documents into a specific category."""

import logging
from typing import Any

from agents import Tool, function_tool
from pydantic import Field

logger = logging.getLogger(__name__)


def create_classification_function(
    category: str,
    category_description: str,
    classification_results: dict[str, list[str]],
    classification_progress: dict[str, bool],
) -> Tool:
    """Create a function tool for classifying documents into a specific category."""

    async def classify_as_category(
        document_numbers: list[str] = Field(
            description=f"List of document numbers (as strings) that should be classified as {category}. {category_description}"
        ),
    ) -> str:
        """Classify documents as part of the selected category."""
        # Store the document numbers for this category
        classification_results[category] = document_numbers
        classification_progress[category] = True

        logger.info(
            f"✓ Classified {len(document_numbers)} documents as {category}: {document_numbers}"
        )
        return f"Classified {len(document_numbers)} documents as {category}"

    classify_as_category.__name__ = f"classify_{category}"
    return function_tool(classify_as_category)
