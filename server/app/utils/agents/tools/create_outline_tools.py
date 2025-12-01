"""Create outline generation function tool."""

import uuid

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
    ) -> str:
        """Set the outline for the video.
        
        Args:
            name: Short descriptive name for the outline
            outline: The detailed outline content
            
        Returns:
            Confirmation message
        """
        outline_results["name"] = name
        outline_results["outline"] = outline
        outline_progress["outline"] = True

        logger.info(f"✓ Set outline name: {name}")
        logger.info(f"✓ Set outline content: {outline[:100]}...")
        return "Set outline successfully"

    tools.append(function_tool(set_outline))
    
    logger.info(f"Created {len(tools)} outline tool(s)")
    return tools

