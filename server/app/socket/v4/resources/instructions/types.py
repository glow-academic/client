"""Typed event models for instructions resource generation."""

from pydantic import BaseModel


class InstructionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: instructions_generation_complete."""

    artifact_type: str
    resource_type: str = "instructions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    template: str | None = None
    generated: bool | None = None
