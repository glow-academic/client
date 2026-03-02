"""Canonical files entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class FilesEntryData(BaseModel):
    """Canonical files entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    upload_id: str | None = None


class CreateFilesEntrySqlParams(BaseModel):
    session_id: UUID
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.upload_id,
            self.mcp,
        )


class CreateFilesEntrySqlRow(BaseModel):
    id: UUID


class CreateFilesEntryResponse(BaseModel):
    id: UUID
