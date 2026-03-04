"""Attempt chat entry types — handcrafted, co-located with handler."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class CreateAttemptChatResponse(BaseModel):
    id: UUID


class GetAttemptChatResponse(BaseModel):
    chat_id: UUID
    attempt_id: UUID
    chat_entry_id: UUID | None
    group_id: UUID | None
    profile_id: UUID | None
    cohort_id: UUID | None
    department_id: UUID | None
    simulation_id: UUID | None
    scenario_id: UUID | None
    persona_ids: list[UUID] | None
    rubric_id: UUID | None
    grade_score: int | None
    grade_total_points: int | None
    grade_pass_points: int | None
    grade_passed: bool | None
    grade_time_taken: int | None
    completed: bool | None
    attempt_number: int | None
    chat_created_at: datetime | None
    attempt_date: date | None
    attempt_type: str | None
    is_archived: bool | None
    infinite_mode: bool | None
