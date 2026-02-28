"""Canonical attempt grade entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class AttemptGradeEntryData(BaseModel):
    """Canonical attempt grade entry fields. All optional for streaming support."""

    id: str | None = None
    chat_id: str | None = None
    run_id: str | None = None
    rubric_grade_agent_id: str | None = None
    rubric_id: str | None = None
    created_at: str | None = None
    passed: bool | None = None
    score: int | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None


class CreateAttemptGradeEntryRequest(BaseModel):
    run_id: UUID
    chat_id: UUID
    passed: bool = False
    score: int = 0
    time_taken: int | None = None


class CreateAttemptGradeEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateAttemptGradeEntrySqlParams(BaseModel):
    run_id: UUID
    chat_id: UUID
    passed: bool = False
    score: int = 0
    time_taken: int | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.chat_id,
            self.passed,
            self.score,
            self.time_taken,
            self.mcp,
        )


class CreateAttemptGradeEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
