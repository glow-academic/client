"""Create all grading function tools for the standard groups."""

import uuid
from collections.abc import Awaitable, Callable, Mapping, Sequence
from typing import Any

from agents import Tool, function_tool
from pydantic import Field

from app.main import get_internal_sio
from app.utils.agents.tools.create_grading_function import create_grading_function
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)
internal_sio = get_internal_sio()


def create_grading_tools(
    standard_groups: Sequence[Mapping[str, Any]],
    standards: Sequence[Mapping[str, Any]],
    chat_id: uuid.UUID,
    emit_progress_func: Callable[[dict[str, Any]], Awaitable[None]],
    profile_id: str | None = None,
    grade_id: str | None = None,
    message_id_map: dict[str, int] | None = None,
    trace_id: str | None = None,
) -> list[Tool]:
    """Create all grading function tools for the standard groups.

    Args:
        standard_groups: List of standard groups to grade
        standards: List of all standards
        chat_id: Chat ID for the grading operation
        emit_progress_func: Function to emit progress events
        profile_id: Profile ID for tenant isolation
        grade_id: Grade ID for database inserts
        message_id_map: Map of message_id -> message_number for message feedback tools
    """
    tools = []
    total_standard_groups = len(standard_groups)

    for group in standard_groups:
        tool = create_grading_function(
            group,
            standards,
            chat_id,
            total_standard_groups,
            emit_progress_func,
            profile_id,
            grade_id,
            trace_id,
        )
        tools.append(tool)
        logger.info(f"Created grading tool for: {group['name']}")

    # Add message_strength tool
    if grade_id and message_id_map:

        async def message_strength(
            message_number: int = Field(
                description="Message number (as shown in conversation history, e.g., 1, 3, 5) to add strength feedback to"
            ),
            feedback: str = Field(
                description="Description of what was strong about this message"
            ),
            highlight: list[str] | None = Field(
                default=None,
                description="List of sections to highlight as strengths (e.g., ['section1', 'section2'])",
            ),
        ) -> str:
            """Add strength feedback to a specific message.

            This tool allows you to highlight what was strong about a specific message
            in the conversation. You can optionally highlight specific sections.

            Args:
                message_number: Message number from the conversation history
                feedback: Description of the strength
                highlight: Optional list of sections to highlight

            Returns:
                Confirmation message
            """
            if not grade_id or not message_id_map:
                return "Error: Grade ID or message map not available"

            await internal_sio.emit(
                "grading_tool_message_strength",
                {
                    "chat_id": str(chat_id),
                    "trace_id": trace_id or "grading",
                    "grade_id": grade_id,
                    "message_number": message_number,
                    "feedback": feedback,
                    "highlight": highlight or [],
                    "message_id_map": message_id_map,
                    "profile_id": profile_id,
                },
            )

            await emit_progress_func(
                {
                    "type": "message_strength_added",
                    "chat_id": str(chat_id),
                    "message_number": message_number,
                    "feedback_preview": feedback[:100] + "..."
                    if len(feedback) > 100
                    else feedback,
                }
            )

            logger.info(f"✓ Added strength feedback to message {message_number}")
            return f"Strength feedback added to message {message_number}"

        tools.append(function_tool(message_strength))
        logger.info("Created message_strength tool")

        # Add message_improvement tool
        async def message_improvement(
            message_number: int = Field(
                description="Message number (as shown in conversation history, e.g., 1, 3, 5) to add improvement feedback to"
            ),
            feedback: str = Field(
                description="Description of what could be improved about this message"
            ),
            strike: list[dict[str, str]] | None = Field(
                default=None,
                description="List of find/replace pairs for strikethrough suggestions (e.g., [{'find': 'keyword', 'replace': 'better keyword'}])",
            ),
        ) -> str:
            """Add improvement feedback to a specific message.

            This tool allows you to suggest improvements for a specific message
            in the conversation. You can optionally provide strikethrough/replace suggestions.

            Args:
                message_number: Message number from the conversation history
                feedback: Description of the improvement
                strike: Optional list of find/replace pairs for strikethrough

            Returns:
                Confirmation message
            """
            if not grade_id or not message_id_map:
                return "Error: Grade ID or message map not available"

            await internal_sio.emit(
                "grading_tool_message_improvement",
                {
                    "chat_id": str(chat_id),
                    "trace_id": trace_id or "grading",
                    "grade_id": grade_id,
                    "message_number": message_number,
                    "feedback": feedback,
                    "strike": strike or [],
                    "message_id_map": message_id_map,
                    "profile_id": profile_id,
                },
            )

            await emit_progress_func(
                {
                    "type": "message_improvement_added",
                    "chat_id": str(chat_id),
                    "message_number": message_number,
                    "feedback_preview": feedback[:100] + "..."
                    if len(feedback) > 100
                    else feedback,
                }
            )

            logger.info(f"✓ Added improvement feedback to message {message_number}")
            return f"Improvement feedback added to message {message_number}"

        tools.append(function_tool(message_improvement))
        logger.info("Created message_improvement tool")

    logger.info(f"Total grading tools created: {len(tools)}")
    return tools
