"""Canonical responses entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ResponsesEntryData(BaseModel):
    """Canonical responses entry fields. All optional for streaming support."""

    response_id: str | None = None
    chat_id: str | None = None
    question_id: str | None = None
    option_id: str | None = None
    completed: bool | None = None
    created_at: str | None = None
