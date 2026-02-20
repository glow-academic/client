"""Canonical training department entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TrainingDepartmentEntryData(BaseModel):
    """Canonical training department entry fields. All optional for streaming support."""

    id: str | None = None
    training_id: str | None = None
    departments_id: str | None = None
    config_signature: str | None = None
    created_at: str | None = None
