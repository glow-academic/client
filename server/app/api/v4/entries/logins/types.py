"""Canonical logins entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class LoginsEntryData(BaseModel):
    """Canonical logins entry fields. All optional for streaming support."""

    id: str | None = None
    last_login: str | None = None
    created_at: str | None = None
    call_id: str | None = None
    session_id: str | None = None
