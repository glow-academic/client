"""Create a function tool for classifying documents into a specific category."""

import logging
from typing import Any

from agents import function_tool
from app.utils.agents.tools.globals import (classification_progress,
                                            classification_results)
from pydantic import Field

logger = logging.getLogger(__name__)


def create_classification_function(category: str, category_description: str) -> Any:
    """Create a function tool for classifying documents into a specific category."""

    async def classify_as_category(
        document_numbers: list[str] = Field(
            description=f"List of document numbers (as strings) that should be classified as {category}. {category_description}"
        ),
    ) -> str:
        f"""Classify documents as {category}.
        
        Use this tool to mark documents that belong to the {category} category.
        {category_description}
        
        Args:
            document_numbers: List of document numbers (e.g., ["1", "3", "5"]) that are {category}
            
        Returns:
            Confirmation message
        """
        # Store the document numbers for this category
        classification_results[category] = document_numbers
        classification_progress[category] = True

        logger.info(
            f"✓ Classified {len(document_numbers)} documents as {category}: {document_numbers}"
        )
        return f"Classified {len(document_numbers)} documents as {category}"

    classify_as_category.__name__ = f"classify_{category}"
    return function_tool(classify_as_category)

