"""Canonical models resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ModelsResourceData(BaseModel):
    """Canonical models resource fields. All optional for streaming support."""

    id: str | None = None
    name: str | None = None
    description: str | None = None
    value: str | None = None
    provider_id: str | None = None
    modality_ids: list[str] | None = None
    temperature_level_ids: list[str] | None = None
    reasoning_level_ids: list[str] | None = None
    quality_ids: list[str] | None = None
    voice_ids: list[str] | None = None
    active: bool | None = None
    generated: bool | None = None
