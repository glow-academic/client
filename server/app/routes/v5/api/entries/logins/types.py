"""Canonical logins entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class LoginsEntryData(BaseModel):
    """Canonical logins entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    session_id: str | None = None


class CreateLoginsEntrySqlParams(BaseModel):
    session_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.mcp,
        )


class CreateLoginsEntrySqlRow(BaseModel):
    id: UUID


class CreateLoginsEntryResponse(BaseModel):
    id: UUID
