"""Canonical uploads entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class UploadsEntryData(BaseModel):
    """Canonical uploads entry fields. All optional for streaming support."""

    created_at: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    size: int | None = None
    id: str | None = None


class CreateUploadsEntrySqlParams(BaseModel):
    session_id: UUID
    file_path: str
    mime_type: str
    size: int
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.file_path,
            self.mime_type,
            self.size,
            self.mcp,
        )


class CreateUploadsEntrySqlRow(BaseModel):
    id: UUID


class CreateUploadsEntryResponse(BaseModel):
    id: UUID
