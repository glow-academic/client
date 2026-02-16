"""Canonical options resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class OptionsResourceData(BaseModel):
    """Canonical options resource fields. All optional for streaming support."""

    option_id: str | None = None
    option_text: str | None = None
    is_correct: bool | None = None
    generated: bool | None = None
    question_id: str | None = None
