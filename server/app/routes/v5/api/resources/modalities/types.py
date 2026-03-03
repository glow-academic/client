"""Canonical modalities resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ModalitiesResourceData(BaseModel):
    """Canonical modalities resource fields. All optional for streaming support."""

    id: str | None = None
    modality: str | None = None
    is_input: bool | None = None
    generated: bool | None = None
