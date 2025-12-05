"""Create outline generation function tool."""

import json
import uuid
from typing import Any

from agents import Tool, function_tool
from pydantic import Field

from app.utils.logging.db_logger import get_logger
from app.main import outline_progress, outline_results, question_progress, question_results

logger = get_logger(__name__)


def create_outline_tools(group_id: uuid.UUID | None, include_questions: bool = True) -> list[Tool]:
    """Create outline generation function tools.
    
    Args:
        group_id: Optional group ID for tracing
        include_questions: Whether to include question generation tools (default True)
    
    Returns:
        List of tools for setting the outline and optionally generating questions.
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
            description="REQUIRED if questions were provided - Dictionary mapping question IDs (use exact IDs from the questions section: 1, 2, 3, etc.) to lists of timestamps (in seconds) where each question should appear. Timestamps must be integers between 0 and video_length_seconds (inclusive). Format as JSON object. Example for 4-second video: {'1': [0, 2], '2': [3]}. Example for 60-second video: {'1': [10, 30], '2': [45]}. You MUST assign timestamps to ALL questions that were provided."
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

    async def set_video_name(
        video_name: str = Field(
            description="A descriptive name for the video based on its content, policies, and purpose. This should be a clear, concise title that reflects what the video is about (e.g., 'Customer Service Best Practices', 'Safety Protocol Overview')."
        ),
    ) -> str:
        """Set the video name.
        
        Args:
            video_name: Descriptive name for the video
            
        Returns:
            Confirmation message
        """
        outline_results["video_name"] = video_name
        outline_progress["video_name"] = True
        
        logger.info(f"✓ Set video name: {video_name}")
        return "Set video name successfully"

    async def set_multiple_choice_question(
        question_text: str = Field(
            description="The question text for the multiple choice question"
        ),
        options: list[str] = Field(
            description="List of answer options (typically 4-5 options)"
        ),
        correct_option_index: int = Field(
            description="Index (0-based) of the correct option"
        ),
    ) -> str:
        """Set a multiple choice question with options and correct answer.
        
        Args:
            question_text: The question text
            options: List of answer options
            correct_option_index: Index of the correct option (0-based)
            
        Returns:
            Confirmation message
        """
        if correct_option_index < 0 or correct_option_index >= len(options):
            raise ValueError(
                f"correct_option_index {correct_option_index} is out of range for {len(options)} options"
            )
        
        question_results["multiple_choice"] = {
            "question_text": question_text,
            "type": "choice",
            "allow_multiple": False,
            "options": [
                {
                    "option_text": opt,
                    "type": "discrete",
                    "is_correct": i == correct_option_index,
                }
                for i, opt in enumerate(options)
            ],
        }
        question_progress["multiple_choice"] = True
        
        logger.info(f"✓ Set multiple choice question: {question_text[:50]}...")
        return "Set multiple choice question successfully"

    async def set_free_response_question(
        question_text: str = Field(
            description="The question text for the free response question"
        ),
    ) -> str:
        """Set a free response question (FRQ).
        
        Args:
            question_text: The question text
            
        Returns:
            Confirmation message
        """
        question_results["free_response"] = {
            "question_text": question_text,
            "type": "frq",
            "allow_multiple": False,
            "options": [],
        }
        question_progress["free_response"] = True
        
        logger.info(f"✓ Set free response question: {question_text[:50]}...")
        return "Set free response question successfully"

    async def set_multi_select_question(
        question_text: str = Field(
            description="The question text for the multi-select question"
        ),
        options: list[str] = Field(
            description="List of answer options"
        ),
        correct_option_indices: list[int] = Field(
            description="List of indices (0-based) of correct options"
        ),
    ) -> str:
        """Set a multi-select question with multiple correct answers.
        
        Args:
            question_text: The question text
            options: List of answer options
            correct_option_indices: List of indices of correct options (0-based)
            
        Returns:
            Confirmation message
        """
        if not correct_option_indices:
            raise ValueError("At least one correct option must be specified")
        
        for idx in correct_option_indices:
            if idx < 0 or idx >= len(options):
                raise ValueError(
                    f"correct_option_indices contains invalid index {idx} for {len(options)} options"
                )
        
        question_results["multi_select"] = {
            "question_text": question_text,
            "type": "choice",
            "allow_multiple": True,
            "options": [
                {
                    "option_text": opt,
                    "type": "discrete",
                    "is_correct": i in correct_option_indices,
                }
                for i, opt in enumerate(options)
            ],
        }
        question_progress["multi_select"] = True
        
        logger.info(f"✓ Set multi-select question: {question_text[:50]}...")
        return "Set multi-select question successfully"

    tools.append(function_tool(set_outline))
    tools.append(function_tool(set_video_name))
    
    if include_questions:
        tools.append(function_tool(set_multiple_choice_question))
        tools.append(function_tool(set_multi_select_question))
        logger.info(f"Created {len(tools)} outline and question tools (multiple choice and multi-select)")
    else:
        logger.info(f"Created {len(tools)} outline tools (questions disabled)")
    
    return tools

