"""Typed event models for examples resource generation."""

from pydantic import BaseModel


class ExamplesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: examples_generation_complete."""

    artifact_type: str
    resource_type: str = "examples"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    example: str | None = None
    idx: int | None = None
    generated: bool | None = None
