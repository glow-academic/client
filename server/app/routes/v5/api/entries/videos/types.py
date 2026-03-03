"""Canonical videos entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class VideosEntryData(BaseModel):
    """Canonical videos entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    call_id: str | None = None
    upload_id: str | None = None
    message_id: str | None = None
    length_seconds: int | None = None


class CreateVideosEntrySqlParams(BaseModel):
    session_id: UUID
    message_id: UUID | None = None
    length_seconds: int = 0
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.message_id,
            self.length_seconds,
            self.mcp,
        )


class CreateVideosEntrySqlRow(BaseModel):
    id: UUID


class CreateVideosEntryResponse(BaseModel):
    id: UUID
