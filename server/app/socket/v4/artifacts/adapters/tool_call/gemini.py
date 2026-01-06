"""Gemini tool call streaming adapter - stub implementation."""

import uuid
from typing import Any

from .base import BaseToolCallAdapter


class GeminiToolCallAdapter(BaseToolCallAdapter):
    """Gemini tool call streaming adapter - not yet implemented."""

    async def stream_tool_calls(
        self,
        runner: Any,
        sid: str,
        resource_id: str | None,
        resource_type: str,
        run_id: uuid.UUID,
        group_id: uuid.UUID | None,
        tool_name_to_type: dict[str, str],
        required_tool_names: set[str],
    ) -> set[str]:
        """Stream tool calls - not yet implemented."""
        raise NotImplementedError("Gemini tool call adapter not yet implemented")

