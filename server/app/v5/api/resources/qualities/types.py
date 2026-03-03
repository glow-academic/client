"""Canonical qualities resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class QualitiesResourceData(BaseModel):
    """Canonical qualities resource fields. All optional for streaming support."""

    id: str | None = None
    quality: str | None = None
    generated: bool | None = None
