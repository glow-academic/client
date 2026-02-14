"""Typed event models for emails resource generation."""

from typing import Any

from pydantic import BaseModel


class EmailsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: emails_generation_complete."""

    artifact_type: str
    resource_type: str = "emails"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
