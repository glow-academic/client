"""Typed event models for voices resource generation."""

from typing import Any

from pydantic import BaseModel


class VoicesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: voices_generation_complete."""

    artifact_type: str
    resource_type: str = "voices"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
