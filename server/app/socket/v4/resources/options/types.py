"""Typed event models for options resource generation."""

from typing import Any

from pydantic import BaseModel


class OptionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: options_generation_complete."""

    artifact_type: str
    resource_type: str = "options"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
