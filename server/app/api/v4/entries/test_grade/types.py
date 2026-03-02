"""Canonical test grade entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class TestGradeEntryData(BaseModel):
    """Canonical test grade entry fields. All optional for streaming support."""

    id: str | None = None
    invocation_id: str | None = None
    run_id: str | None = None
    rubric_grade_agent_id: str | None = None
    created_at: str | None = None
    passed: bool | None = None
    score: int | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None


class CreateTestGradeEntryRequest(BaseModel):
    run_id: UUID
    invocation_id: UUID
    passed: bool = False
    score: int = 0
    time_taken: int | None = None


class CreateTestGradeEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateTestGradeEntrySqlParams(BaseModel):
    run_id: UUID
    invocation_id: UUID
    passed: bool = False
    score: int = 0
    time_taken: int | None = None
    tool_id: UUID | None = None
    upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (
            self.run_id,
            self.invocation_id,
            self.passed,
            self.score,
            self.time_taken,
            self.tool_id,
            self.upload_id,
            self.mcp,
        )


class CreateTestGradeEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
