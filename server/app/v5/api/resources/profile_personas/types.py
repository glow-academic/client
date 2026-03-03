"""Canonical profile_personas resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class ProfilePersonasResourceData(BaseModel):
    """Canonical profile_personas resource fields. All optional for streaming support."""

    id: str | None = None
    profile_id: str | None = None
    persona_id: str | None = None
    generated: bool | None = None
