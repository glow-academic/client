"""Canonical emulations entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class EmulationsEntryData(BaseModel):
    """Canonical emulations entry fields. All optional for streaming support."""

    id: str | None = None
    grant_id: str | None = None
    created_at: str | None = None
    session_id: str | None = None


class CreateEmulationsEntrySqlParams(BaseModel):
    session_id: UUID
    grant_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.grant_id,
            self.mcp,
        )


class CreateEmulationsEntrySqlRow(BaseModel):
    id: UUID


class CreateEmulationsEntryResponse(BaseModel):
    id: UUID
