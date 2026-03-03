"""Canonical home entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class HomeEntryData(BaseModel):
    """Canonical home entry fields. All optional for streaming support."""

    id: str | None = None
    audio_enabled: bool | None = None
    text_enabled: bool | None = None
    hints_enabled: bool | None = None
    copy_paste_allowed: bool | None = None
    show_images: bool | None = None
    show_objectives: bool | None = None
    show_problem_statement: bool | None = None
    created_at: str | None = None
