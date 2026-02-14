"""Typed event models for group_positions resource generation."""

from typing import Any

from pydantic import BaseModel


class GroupPositionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: group_positions_generation_complete."""

    artifact_type: str
    resource_type: str = "group_positions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
