"""Canonical attempt message tree entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AttemptMessageTreeEntryData(BaseModel):
    """Canonical attempt message tree entry fields. All optional for streaming support."""

    parent_id: str | None = None
    child_id: str | None = None
    created_at: str | None = None


class CreateAttemptMessageTreeEntrySqlParams(BaseModel):
    parent_id: UUID
    child_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.parent_id,
            self.child_id,
            self.mcp,
        )


class CreateAttemptMessageTreeEntrySqlRow(BaseModel):
    id: UUID | None = None


class CreateAttemptMessageTreeEntryResponse(BaseModel):
    id: UUID | None = None
