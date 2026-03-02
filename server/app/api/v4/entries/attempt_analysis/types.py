"""Canonical analyses entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AnalysesEntryData(BaseModel):
    """Canonical analyses entry fields. All optional for streaming support."""

    analysis_id: str | None = None
    grade_id: str | None = None
    content: str | None = None
    created_at: str | None = None


class CreateAttemptAnalysisEntryRequest(BaseModel):
    run_id: UUID
    grade_id: UUID
    content: str = ""


class CreateAttemptAnalysisEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptAnalysisEntrySqlParams(BaseModel):
    run_id: UUID
    grade_id: UUID
    content: str = ""
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.grade_id,
            self.content,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateAttemptAnalysisEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
