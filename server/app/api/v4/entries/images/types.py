"""Canonical images entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class ImagesEntryData(BaseModel):
    """Canonical images entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    call_id: str | None = None
    upload_id: str | None = None
    message_id: str | None = None


class CreateImagesEntrySqlParams(BaseModel):
    session_id: UUID
    message_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.message_id,
            self.mcp,
        )


class CreateImagesEntrySqlRow(BaseModel):
    id: UUID


class CreateImagesEntryResponse(BaseModel):
    id: UUID
