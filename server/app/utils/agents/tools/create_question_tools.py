"""Create all question generation function tools."""

import uuid

from agents import Tool, function_tool
from pydantic import Field

from app.main import get_question_storage
from app.utils.logging.db_logger import get_logger
from app.utils.storage.request_storage import build_storage_key

logger = get_logger(__name__)


def create_question_tools(
    group_id: uuid.UUID | None,
    profile_id: str | None = None,
    primary_id: str | None = None,
) -> list[Tool]:
    """Create all question generation function tools.

    Args:
        group_id: Optional group ID
        profile_id: Profile ID for tenant isolation
        primary_id: Primary ID for storage key (video_id, trace_id, etc.)

    Returns exactly 3 tools for:
    1. Multiple choice question
    2. Free response question
    3. Multi-select question
    """
    if not profile_id or not primary_id:
        logger.warning("profile_id and primary_id required for question storage")

    tools = []

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

        if not profile_id or not primary_id:
            return "Error: Storage configuration missing"

        storage = get_question_storage()
        storage_key = build_storage_key(
            operation_type="question_generation",
            profile_id=profile_id,
            primary_id=primary_id,
        )

        await storage.set(
            storage_key,
            "multiple_choice",
            {
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
            },
        )
        await storage.set(storage_key, "multiple_choice_progress", True)

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
        if not profile_id or not primary_id:
            return "Error: Storage configuration missing"

        storage = get_question_storage()
        storage_key = build_storage_key(
            operation_type="question_generation",
            profile_id=profile_id,
            primary_id=primary_id,
        )

        await storage.set(
            storage_key,
            "free_response",
            {
                "question_text": question_text,
                "type": "frq",
                "allow_multiple": False,
                "options": [],
            },
        )
        await storage.set(storage_key, "free_response_progress", True)

        logger.info(f"✓ Set free response question: {question_text[:50]}...")
        return "Set free response question successfully"

    async def set_multi_select_question(
        question_text: str = Field(
            description="The question text for the multi-select question"
        ),
        options: list[str] = Field(description="List of answer options"),
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

        if not profile_id or not primary_id:
            return "Error: Storage configuration missing"

        storage = get_question_storage()
        storage_key = build_storage_key(
            operation_type="question_generation",
            profile_id=profile_id,
            primary_id=primary_id,
        )

        await storage.set(
            storage_key,
            "multi_select",
            {
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
            },
        )
        await storage.set(storage_key, "multi_select_progress", True)

        logger.info(f"✓ Set multi-select question: {question_text[:50]}...")
        return "Set multi-select question successfully"

    tools.append(function_tool(set_multiple_choice_question))
    tools.append(function_tool(set_free_response_question))
    tools.append(function_tool(set_multi_select_question))

    logger.info(f"Created {len(tools)} question tools")
    return tools
