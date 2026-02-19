"""Types for attempt entries."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AttemptFilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str
    count: int = 0


class AttemptViewItem(BaseModel):
    """Single attempt from the attempt list."""

    attempt_id: UUID
    simulation_id: UUID | None = None
    profile_id: UUID | None = None
    cohort_id: UUID | None = None
    department_id: UUID | None = None
    practice: bool = False
    infinite_mode: bool = False
    created_at: datetime | None = None
    is_archived: bool = False
    scenario_ids: list[UUID] | None = None


class GetAttemptsResponse(BaseModel):
    """Response containing attempt data."""

    items: list[AttemptViewItem] = Field(
        default_factory=list, description="Attempt data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
    simulation_options: list[AttemptFilterOption] | None = Field(
        default=None, description="Available simulation filter options"
    )
    scenario_options: list[AttemptFilterOption] | None = Field(
        default=None, description="Available scenario filter options"
    )
    profile_options: list[AttemptFilterOption] | None = Field(
        default=None, description="Available profile filter options"
    )


class GradeItem(BaseModel):
    """Grade composite type."""

    score: float | None = None
    passed: bool | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None


class ChatViewItem(BaseModel):
    """Single chat from attempt chats."""

    chat_id: UUID
    attempt_id: UUID | None = None
    group_id: UUID | None = None
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    problem_statement_id: UUID | None = None
    copy_paste_allowed: bool | None = None
    text_enabled: bool | None = None
    audio_enabled: bool | None = None
    hints_enabled: bool | None = None
    show_images: bool | None = None
    show_objectives: bool | None = None
    show_problem_statement: bool | None = None
    time_limit_seconds: int | None = None
    negative: bool | None = None
    created_at: datetime | None = None
    completed: bool = False
    grade: GradeItem | None = None
    persona_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class AttemptMessageViewItem(BaseModel):
    """Single message from attempt messages."""

    message_id: UUID
    chat_id: UUID | None = None
    attempt_id: UUID | None = None
    type: str | None = None
    created_at: datetime | None = None
    completed: bool = False
    runs_id: UUID | None = None
    history_content: str | None = None
    audio_id: UUID | None = None
