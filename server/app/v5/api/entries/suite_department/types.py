"""Canonical suite department entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class SuiteDepartmentEntryData(BaseModel):
    """Canonical suite department entry fields. All optional for streaming support."""

    id: str | None = None
    suite_id: str | None = None
    departments_id: str | None = None
    config_signature: str | None = None
    created_at: str | None = None
