"""Canonical highlights entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class HighlightsEntryData(BaseModel):
    """Canonical highlights entry fields. All optional for streaming support."""

    highlight_id: str | None = None
    strength_id: str | None = None
    section: str | None = None
    idx: int | None = None
    created_at: str | None = None


class CreateAttemptHighlightEntryRequest(BaseModel):
    run_id: UUID
    strength_id: UUID
    section: str = ""
    idx: int = 0


class CreateAttemptHighlightEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptHighlightEntrySqlParams(BaseModel):
    run_id: UUID
    strength_id: UUID
    section: str = ""
    idx: int = 0
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.strength_id,
            self.section,
            self.idx,
            self.mcp,
        )


class CreateAttemptHighlightEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
