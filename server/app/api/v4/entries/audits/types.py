"""Canonical audits entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AuditsEntryData(BaseModel):
    """Canonical audits entry fields. All optional for streaming support."""

    created_at: str | None = None
    message: str | None = None
    endpoint: str | None = None
    error: bool | None = None
    id: str | None = None
    session_id: str | None = None


class CreateAuditsEntrySqlParams(BaseModel):
    session_id: UUID
    message: str
    endpoint: str
    error: bool = False
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.message,
            self.endpoint,
            self.error,
            self.mcp,
        )


class CreateAuditsEntrySqlRow(BaseModel):
    id: UUID


class CreateAuditsEntryResponse(BaseModel):
    id: UUID
