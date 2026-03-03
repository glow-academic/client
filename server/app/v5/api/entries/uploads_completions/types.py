"""Canonical uploads completions entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class UploadsCompletionsEntryData(BaseModel):
    """Canonical uploads completions entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    upload_id: str | None = None
    end_reason: str | None = None


class CreateUploadsCompletionsEntrySqlParams(BaseModel):
    session_id: UUID
    upload_id: UUID
    end_reason: str = ""
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.session_id,
            self.upload_id,
            self.end_reason,
            self.mcp,
        )


class CreateUploadsCompletionsEntrySqlRow(BaseModel):
    id: UUID


class CreateUploadsCompletionsEntryResponse(BaseModel):
    id: UUID
