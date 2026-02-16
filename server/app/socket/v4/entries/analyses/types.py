"""Typed event models for analyses entry socket events."""

from typing import Any

from pydantic import BaseModel


class AnalysesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: analyses_generation_complete."""

    artifact_type: str
    entry_type: str = "analyses"
    entry_id: str | None = None
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    success: bool = True


class AnalysesGenerationErrorEvent(BaseModel):
    """Server-to-client event: analyses_generation_error."""

    artifact_type: str
    entry_type: str = "analyses"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
