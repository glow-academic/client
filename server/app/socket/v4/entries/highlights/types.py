"""Typed event models for highlights entry socket events."""

from typing import Any

from pydantic import BaseModel


class HighlightsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: highlights_generation_complete."""

    artifact_type: str
    entry_type: str = "highlights"
    entry_id: str | None = None
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    success: bool = True


class HighlightsGenerationErrorEvent(BaseModel):
    """Server-to-client event: highlights_generation_error."""

    artifact_type: str
    entry_type: str = "highlights"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
