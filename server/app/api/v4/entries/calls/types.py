"""Canonical calls entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class CallsEntryData(BaseModel):
    """Canonical calls entry fields. All optional for streaming support."""

    created_at: str | None = None
    external_call_id: str | None = None
    id: str | None = None
    arguments_raw: str | None = None
    run_id: str | None = None
