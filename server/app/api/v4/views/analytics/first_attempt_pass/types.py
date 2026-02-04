"""Types for analytics first-attempt-pass view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FirstAttemptPassItem(BaseModel):
    attempt_id: UUID
    profile_id: UUID
    simulation_id: UUID
    attempt_created_at: datetime
    grade_percent: float | None = None
    rubric_pass_points: int | None = None
    rubric_total_points: int | None = None


class GetFirstAttemptPassRequest(BaseModel):
    profile_id: UUID | None = None
    cohort_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    attempt_type: str | None = None
    is_archived: bool = False
    date_from: datetime | None = None
    date_to: datetime | None = None


class GetFirstAttemptPassResponse(BaseModel):
    items: list[FirstAttemptPassItem] = Field(default_factory=list)
