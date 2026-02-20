"""Canonical tokens entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class TokensEntryData(BaseModel):
    """Canonical tokens entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    run_id: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    cached_input_tokens: int | None = None
