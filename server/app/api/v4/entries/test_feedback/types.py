"""Canonical test feedback entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TestFeedbackEntryData(BaseModel):
    """Canonical test feedback entry fields. All optional for streaming support."""

    id: str | None = None
    grade_id: str | None = None
    total: int | None = None
    feedback: str | None = None
    created_at: str | None = None
    call_id: str | None = None
    total_points: int | None = None
    pass_points: int | None = None


class CreateTestFeedbackEntryRequest(BaseModel):
    run_id: UUID
    grade_id: UUID
    total: int = 0
    feedback: str = ""
    total_points: int | None = None
    pass_points: int | None = None


class CreateTestFeedbackEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateTestFeedbackEntrySqlParams(BaseModel):
    run_id: UUID
    grade_id: UUID
    total: int = 0
    feedback: str = ""
    total_points: int | None = None
    pass_points: int | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.grade_id,
            self.total,
            self.feedback,
            self.total_points,
            self.pass_points,
            self.mcp,
        )


class CreateTestFeedbackEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
