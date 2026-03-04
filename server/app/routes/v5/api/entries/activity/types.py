"""Canonical activity entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ActivityEntryData(BaseModel):
    """Canonical activity entry fields. All optional for streaming support."""

    created_at: str | None = None
    id: str | None = None
    session_id: str | None = None


class CreateActivityEntrySqlParams(BaseModel):
    session_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.mcp,
        )


class CreateActivityEntrySqlRow(BaseModel):
    id: UUID


class CreateActivityEntryResponse(BaseModel):
    id: UUID
