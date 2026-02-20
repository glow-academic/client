"""Canonical suite entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class SuiteEntryData(BaseModel):
    """Canonical suite entry fields. All optional for streaming support."""

    id: str | None = None
    benchmark_id: str | None = None
    created_at: str | None = None
