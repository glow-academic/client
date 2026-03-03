"""Canonical instructions resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class InstructionsResourceData(BaseModel):
    """Canonical instructions resource fields. All optional for streaming support."""

    id: str | None = None
    template: str | None = None
    generated: bool | None = None
