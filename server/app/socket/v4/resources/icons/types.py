"""Typed event models for icons resource generation."""

from pydantic import BaseModel


class IconsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: icons_generation_complete."""

    artifact_type: str
    resource_type: str = "icons"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    generated: bool | None = None
