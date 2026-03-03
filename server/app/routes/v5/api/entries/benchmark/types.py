"""Canonical benchmark entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class BenchmarkEntryData(BaseModel):
    """Canonical benchmark entry fields. All optional for streaming support."""

    id: str | None = None
    use_groups: bool | None = None
    dynamic: bool | None = None
    created_at: str | None = None
