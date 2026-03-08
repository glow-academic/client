"""Shared types and utilities for v5 WebSocket handlers.

This module is the single source of truth for types previously scattered
across v4 socket modules. All v5 handlers should import from here
instead of from app.socket.v4.
"""

from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel

# =============================================================================
# Internal Server-to-Server Events
# =============================================================================
# Re-exported from infra — canonical location is app.infra.websocket.generation_types
from app.infra.websocket.generation_types import (
    GenerateErrorApiRequest as GenerateErrorApiRequest,
)

# =============================================================================
# Test domain types
# =============================================================================
# Re-exported from infra — canonical location is app.infra.websocket.test_types
from app.infra.websocket.test_types import (
    TestAllCompleteEvent as TestAllCompleteEvent,
)


# Entry type constants (predefined per handler, not in payload)
TEST_GRADE_ENTRY_TYPES = ["grades", "feedbacks"]
MESSAGE_ENTRY_TYPES = ["contents", "hints"]

# =============================================================================
# Test domain utilities
# =============================================================================


def determine_next_run(
    invocation_run_ids: list[uuid.UUID],
    run_ids: list[uuid.UUID],
) -> tuple[uuid.UUID | None, int, int]:
    """Determine the next pending template run to replay.

    Compares configured template runs (run_ids) against completed runs
    (invocation_run_ids) to find the next unexecuted template.

    Returns:
        (next_run_resource_id, current_run_number, total_runs)
    """
    total_runs = len(run_ids)
    completed_runs = len(invocation_run_ids)

    if completed_runs >= total_runs:
        return None, total_runs, total_runs

    next_run_resource_id = (
        run_ids[completed_runs] if completed_runs < total_runs else None
    )
    current_run = completed_runs + 1

    return next_run_resource_id, current_run, total_runs


def build_messages_from_conversation(
    system_prompt: str | None,
    developer_instructions: list[str],
    original_conversation: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build messages array from original conversation.

    Auto-regressive replay pattern:
    1. Add system prompt
    2. Add developer instructions
    3. Add all messages EXCEPT remove tool_calls from last assistant message

    Args:
        system_prompt: System prompt from group config
        developer_instructions: Rendered developer instructions
        original_conversation: Original conversation from previous run

    Returns:
        Messages array ready for LLM completion
    """
    messages: list[dict[str, Any]] = []

    # Add system prompt
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})

    # Add developer instructions
    for instruction in developer_instructions:
        messages.append({"role": "developer", "content": instruction})

    # Add original conversation with truncation
    if original_conversation:
        for i, msg in enumerate(original_conversation):
            role = msg.get("role", "user")
            content = msg.get("content", "")

            # For last assistant message, remove tool_calls to force regeneration
            is_last = i == len(original_conversation) - 1
            if is_last and role == "assistant":
                # Only include the content, not the tool_calls
                messages.append({"role": role, "content": content})
            else:
                # Include everything as-is
                message_dict: dict[str, Any] = {"role": role, "content": content}
                if "tool_calls" in msg:
                    message_dict["tool_calls"] = msg["tool_calls"]
                if "tool_call_id" in msg:
                    message_dict["tool_call_id"] = msg["tool_call_id"]
                messages.append(message_dict)

    return messages
