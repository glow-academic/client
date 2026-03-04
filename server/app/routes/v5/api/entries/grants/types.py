"""Canonical grants entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class GrantsEntryData(BaseModel):
    """Canonical grants entry fields. All optional for streaming support."""

    id: str | None = None
    expires_at: str | None = None
    created_at: str | None = None
    session_id: str | None = None
    active: bool | None = None
    mcp: bool | None = None
    generated: bool | None = None


class CreateGrantsEntrySqlParams(BaseModel):
    session_id: UUID
    expires_at: str
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.expires_at,
            self.mcp,
        )


class CreateGrantsEntrySqlRow(BaseModel):
    id: UUID


class CreateGrantsEntryResponse(BaseModel):
    id: UUID
