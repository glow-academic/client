"""Canonical texts entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TextsEntryData(BaseModel):
    """Canonical texts entry fields. All optional for streaming support."""

    id: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    created_at: str | None = None


class CreateTextsEntrySqlParams(BaseModel):
    session_id: UUID
    upload_id: UUID
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.upload_id,
            self.mcp,
        )


class CreateTextsEntrySqlRow(BaseModel):
    id: UUID


class CreateTextsEntryResponse(BaseModel):
    id: UUID
