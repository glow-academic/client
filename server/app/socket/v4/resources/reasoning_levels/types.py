"""Typed event models for reasoning_levels resource generation."""

from typing import Any

from pydantic import BaseModel


class ReasoningLevelsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: reasoning_levels_generation_complete."""

    artifact_type: str
    resource_type: str = "reasoning_levels"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
