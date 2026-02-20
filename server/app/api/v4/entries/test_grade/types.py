"""Canonical test grade entry type — single source of truth for entry fields."""

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
