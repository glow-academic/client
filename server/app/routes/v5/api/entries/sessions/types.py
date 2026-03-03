"""Canonical sessions entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class SessionsEntryData(BaseModel):
    """Canonical sessions entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    profile_id: str | None = None


class CreateSessionsEntrySqlParams(BaseModel):
    session_id: UUID
    profile_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.profile_id,
            self.mcp,
        )


class CreateSessionsEntrySqlRow(BaseModel):
    id: UUID


class CreateSessionsEntryResponse(BaseModel):
    id: UUID
