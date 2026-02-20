"""Canonical args outputs values entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class ArgsOutputsValuesEntryData(BaseModel):
    """Canonical args outputs values entry fields. All optional for streaming support."""

    id: str | None = None
    call_id: str | None = None
    string_value: str | None = None
    number_value: float | None = None
    boolean_value: bool | None = None
    created_at: str | None = None
