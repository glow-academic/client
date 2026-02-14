"""Typed event models for standards resource generation."""

from typing import Any

from pydantic import BaseModel


class StandardsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: standards_generation_complete."""

    artifact_type: str
    resource_type: str = "standards"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
