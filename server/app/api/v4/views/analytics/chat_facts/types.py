"""Types for analytics chat facts view (mv_chat_facts)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ChatFactsItem(BaseModel):
    """Single chat row from mv_chat_facts."""

    chat_id: UUID
    attempt_id: UUID
    grade_id: UUID | None = None

    simulation_id: UUID
    profile_id: UUID
    cohort_id: UUID | None = None
    department_id: UUID | None = None
    role_id: UUID | None = None
    scenario_id: UUID
    persona_id: UUID | None = None
    rubric_id: UUID | None = None
    parameter_field_ids: list[UUID] = Field(default_factory=list)
    parameter_ids: list[UUID] = Field(default_factory=list)
    field_ids: list[UUID] = Field(default_factory=list)

    attempt_created_at: datetime
    chat_created_at: datetime
    grade_created_at: datetime | None = None

    attempt_type: str
    is_archived: bool = False
    infinite_mode: bool = False
    completed: bool = False

    score: int | None = None
    passed: bool | None = None
    time_taken: int | None = None
    grade_percent: float | None = None
    rubric_total_points: int | None = None
    rubric_pass_points: int | None = None

    num_messages_total: int = 0
    message_time_taken_seconds: list[int] = Field(default_factory=list)


class GetChatFactsRequest(BaseModel):
    """Request for filtering mv_chat_facts."""

    profile_id: UUID | None = None
    profile_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    cohort_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None

    attempt_type: str | None = None
    is_archived: bool = False
    infinite_mode: bool | None = None
    completed: bool | None = None

    date_from: datetime | None = None
    date_to: datetime | None = None
    search: str | None = None

    sort_by: str = Field(default="date", description="'date' | 'score'")
    sort_order: str = Field(default="desc", description="'asc' | 'desc'")

    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class GetChatFactsResponse(BaseModel):
    """Response for chat facts query."""

    items: list[ChatFactsItem] = Field(default_factory=list)
    total_count: int = 0
