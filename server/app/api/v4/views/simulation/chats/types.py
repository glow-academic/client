"""Types for simulation chats view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FeedbackItem(BaseModel):
    """Feedback item with standard info."""

    id: UUID
    standard_id: UUID | None = None
    standard_name: str | None = None
    total: float | None = None
    feedback: str | None = None


class ResponseItem(BaseModel):
    """Quiz response item (no response_id - not a resource)."""

    question_id: UUID | None = None
    option_id: UUID | None = None
    completed: bool | None = None
    created_at: datetime | None = None


class ChatViewItem(BaseModel):
    """Single chat from the simulation chats view."""

    # Primary key
    chat_id: UUID

    # Foreign keys
    attempt_id: UUID | None = None

    # Resource IDs (singular)
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    problem_statement_id: UUID | None = None

    # Resource metadata (JOINed from _resource tables)
    scenario_name: str | None = None
    rubric_name: str | None = None

    # Practice flag
    practice: bool = False

    # Chat-level flags (directly from MV)
    copy_paste_allowed: bool | None = None
    text_enabled: bool | None = None
    audio_enabled: bool | None = None
    hints_enabled: bool | None = None
    show_images: bool | None = None
    show_objectives: bool | None = None
    show_problem_statement: bool | None = None

    # Chat data
    chat_created_at: datetime | None = None
    chat_completed: bool = False
    chat_position: int | None = None
    is_current_chat: bool = False

    # Grade data
    grade_id: UUID | None = None
    grade_score: float | None = None
    grade_passed: bool | None = None
    grade_description: str | None = None
    grade_time_taken: int | None = None
    rubric_total_points: int | None = None
    rubric_pass_points: int | None = None

    # Feedbacks
    feedbacks: list[FeedbackItem] | None = None

    # Resource IDs - Normal/General View (plural arrays)
    persona_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None

    # Resource IDs - Video/Quiz View (plural arrays)
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    responses: list[ResponseItem] | None = None

    # Resource IDs - Both Views (plural arrays)
    template_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None


class GetChatsRequest(BaseModel):
    """Request for getting chat data."""

    attempt_id: UUID | None = Field(
        default=None, description="Filter by attempt ID"
    )
    chat_ids: list[UUID] | None = Field(
        default=None, description="List of specific chat IDs to fetch"
    )
    practice: bool | None = Field(
        default=None,
        description="Filter by practice mode. None=all, True=practice, False=home",
    )


class GetChatsResponse(BaseModel):
    """Response containing chat data."""

    items: list[ChatViewItem] = Field(
        default_factory=list, description="Chat data items"
    )
