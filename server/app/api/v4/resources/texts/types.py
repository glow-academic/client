"""Canonical texts resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class TextsResourceData(BaseModel):
    """Canonical texts resource fields. All optional for streaming support."""

    texts_id: str | None = None
    text_id: str | None = None
    generated: bool | None = None
