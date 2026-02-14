"""Typed event models for colors resource generation."""

from pydantic import BaseModel


class ColorsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: colors_generation_complete."""

    artifact_type: str
    resource_type: str = "colors"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    hex_code: str | None = None
    generated: bool | None = None
