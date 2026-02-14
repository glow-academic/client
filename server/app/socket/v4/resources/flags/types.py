"""Typed event models for flags resource generation."""

from pydantic import BaseModel


class FlagsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: flags_generation_complete."""

    artifact_type: str
    resource_type: str = "flags"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    generated: bool | None = None
