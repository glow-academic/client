"""Typed event models for uploads resource generation."""

from typing import Any

from pydantic import BaseModel


class UploadsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: uploads_generation_complete."""

    artifact_type: str
    resource_type: str = "uploads"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
