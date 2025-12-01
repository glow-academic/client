"""Create outline generation function tool."""

import json
import uuid
from typing import Any, cast

from agents import Tool, function_tool
from pydantic import Field

from app.utils.logging.db_logger import get_logger
from app.main import outline_progress, outline_results

logger = get_logger(__name__)


def create_outline_tools(group_id: uuid.UUID | None) -> list[Tool]:
    """Create outline generation function tool.
    
    Returns a single tool for setting the outline.
    """
    tools = []

    async def set_outline(
        name: str = Field(
            description="Short, descriptive name for the outline (e.g., 'Video Outline v1')"
        ),
        outline: str = Field(
            description="The detailed outline content for the video"
        ),
        question_timestamps: Any | None = Field(
            default=None,
            description="Optional dictionary mapping question IDs to lists of timestamps (in seconds) where each question should appear in the video. Format as JSON object. Example: {'question-id-1': [10, 30], 'question-id-2': [45]}"
        ),
    ) -> str:
        """Set the outline for the video.
        
        Args:
            name: Short descriptive name for the outline
            outline: The detailed outline content
            question_timestamps: Optional dictionary mapping question IDs to lists of timestamps
            
        Returns:
            Confirmation message
        """
        outline_results["name"] = name
        outline_results["outline"] = outline
        if question_timestamps is not None:
            # Ensure question_timestamps is a dict
            if isinstance(question_timestamps, dict):
                outline_results["question_timestamps"] = question_timestamps
            elif isinstance(question_timestamps, str):
                # Try to parse if it's a string
                outline_results["question_timestamps"] = json.loads(question_timestamps)
            else:
                outline_results["question_timestamps"] = question_timestamps
        outline_progress["outline"] = True

        logger.info(f"✓ Set outline name: {name}")
        logger.info(f"✓ Set outline content: {outline[:100]}...")
        if question_timestamps:
            timestamps_dict = outline_results.get("question_timestamps", {})
            if isinstance(timestamps_dict, dict):
                logger.info(f"✓ Set question timestamps for {len(timestamps_dict)} question(s)")
        return "Set outline successfully"

    tool = function_tool(set_outline)
    tools.append(cast(Tool, tool))
    
    logger.info(f"Created {len(tools)} outline tool(s)")
    return cast(list[Tool], tools)

