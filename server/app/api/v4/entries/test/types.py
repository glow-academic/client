"""Canonical test entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TestEntryData(BaseModel):
    """Canonical test entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    infinite_mode: bool | None = None
    benchmark_id: str | None = None
