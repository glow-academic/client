"""Canonical replacements entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ReplacementsEntryData(BaseModel):
    """Canonical replacements entry fields. All optional for streaming support."""

    replacement_id: str | None = None
    improvement_id: str | None = None
    section: str | None = None
    replace_text: str | None = None
    idx: int | None = None
    created_at: str | None = None


class CreateAttemptReplacementEntryRequest(BaseModel):
    run_id: UUID
    improvement_id: UUID
    section: str = ""
    replace: str = ""
    idx: int = 0


class CreateAttemptReplacementEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptReplacementEntrySqlParams(BaseModel):
    run_id: UUID
    improvement_id: UUID
    section: str = ""
    replace: str = ""
    idx: int = 0
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.improvement_id,
            self.section,
            self.replace,
            self.idx,
            self.mcp,
        )


class CreateAttemptReplacementEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
