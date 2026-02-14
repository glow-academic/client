"""Typed event models for descriptions resource generation."""

from pydantic import BaseModel


class DescriptionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: descriptions_generation_complete."""

    artifact_type: str
    resource_type: str = "descriptions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    description: str | None = None
    generated: bool | None = None
