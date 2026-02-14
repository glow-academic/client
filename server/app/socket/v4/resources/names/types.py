"""Typed event models for names resource generation."""

from pydantic import BaseModel


class NamesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: names_generation_complete."""

    artifact_type: str
    resource_type: str = "names"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    generated: bool | None = None
