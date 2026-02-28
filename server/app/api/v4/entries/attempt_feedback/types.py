"""Canonical feedbacks entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class FeedbacksEntryData(BaseModel):
    """Canonical feedbacks entry fields. All optional for streaming support."""

    feedback_id: str | None = None
    grade_id: str | None = None
    standard_id: str | None = None
    total: float | None = None
    feedback: str | None = None
    created_at: str | None = None


class CreateAttemptFeedbackEntryRequest(BaseModel):
    run_id: UUID
    grade_id: UUID
    total: int = 0
    feedback: str = ""


class CreateAttemptFeedbackEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptFeedbackEntrySqlParams(BaseModel):
    run_id: UUID
    grade_id: UUID
    total: int = 0
    feedback: str = ""
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.grade_id,
            self.total,
            self.feedback,
            self.mcp,
        )


class CreateAttemptFeedbackEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
