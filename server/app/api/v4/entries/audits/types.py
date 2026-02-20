"""Canonical audits entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class AuditsEntryData(BaseModel):
    """Canonical audits entry fields. All optional for streaming support."""

    created_at: str | None = None
    message: str | None = None
    endpoint: str | None = None
    error: bool | None = None
    id: str | None = None
    session_id: str | None = None
