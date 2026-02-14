"""Typed event models for personas resource generation."""

from typing import Any

from pydantic import BaseModel


class PersonasGenerationCompleteEvent(BaseModel):
    """Server-to-client event: personas_generation_complete."""

    artifact_type: str
    resource_type: str = "personas"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
