"""Canonical questions resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class QuestionsResourceData(BaseModel):
    """Canonical questions resource fields. All optional for streaming support."""

    question_id: str | None = None
    question_text: str | None = None
    allow_multiple: bool | None = None
    generated: bool | None = None
    time: int | None = None
