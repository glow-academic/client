"""Create a function tool for classifying files into parameter items."""

from agents import Tool, function_tool
from pydantic import Field

from app.main import classification_results
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def create_classification_function(
    parameter_item_id: str, parameter_item_name: str, parameter_item_description: str
) -> Tool:
    """Create a function tool for classifying files into a specific parameter item."""

    async def classify_as_parameter_item(
        file_numbers: list[str] = Field(
            description=f"List of file numbers (as strings) that should be classified as {parameter_item_name}. {parameter_item_description}"
        ),
    ) -> str:
        """Classify files as part of the selected parameter item."""
        # Store the file numbers for this parameter item
        if parameter_item_id not in classification_results:
            classification_results[parameter_item_id] = []
        classification_results[parameter_item_id].extend(file_numbers)

        logger.info(
            f"✓ Classified {len(file_numbers)} files as {parameter_item_name} (ID: {parameter_item_id}): {file_numbers}"
        )
        return f"Classified {len(file_numbers)} files as {parameter_item_name}"

    classify_as_parameter_item.__name__ = (
        f"classify_{parameter_item_id.replace('-', '_')}"
    )
    return function_tool(classify_as_parameter_item)
