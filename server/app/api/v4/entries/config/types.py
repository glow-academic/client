"""Canonical config entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ConfigEntryData(BaseModel):
    """Canonical config entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    run_id: str | None = None
