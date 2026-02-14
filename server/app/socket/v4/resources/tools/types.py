"""Typed event models for tools resource generation."""

from typing import Any

from pydantic import BaseModel


class ToolsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: tools_generation_complete."""

    artifact_type: str
    resource_type: str = "tools"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
