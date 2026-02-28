"""Canonical tokens entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TokensEntryData(BaseModel):
    """Canonical tokens entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    run_id: str | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    cached_input_tokens: int | None = None


class CreateTokensEntrySqlParams(BaseModel):
    session_id: UUID
    run_id: UUID
    input_tokens: int = 0
    output_tokens: int = 0
    cached_input_tokens: int = 0
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.run_id,
            self.input_tokens,
            self.output_tokens,
            self.cached_input_tokens,
            self.mcp,
        )


class CreateTokensEntrySqlRow(BaseModel):
    id: UUID


class CreateTokensEntryResponse(BaseModel):
    id: UUID
