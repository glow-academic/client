"""Typed event models for rubrics resource generation."""

from typing import Any

from pydantic import BaseModel


class RubricsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: rubrics_generation_complete."""

    artifact_type: str
    resource_type: str = "rubrics"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
