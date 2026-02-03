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


class GradeItem(BaseModel):
    """Grade composite type (no id - not a resource, no rubric points - fetched via rubric handler)."""

    score: float | None = None
    passed: bool | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None


class AnalysisItem(BaseModel):
    """Analysis item with content."""

    content: str | None = None


class ChatViewItem(BaseModel):
    """Single chat from the simulation chats view."""

    # Primary key
    chat_id: UUID

    # Foreign keys
    attempt_id: UUID | None = None

    # Resource IDs (singular - metadata fetched via internal handlers)
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    problem_statement_id: UUID | None = None

    # Chat-level flags (directly from MV)
    copy_paste_allowed: bool | None = None
    text_enabled: bool | None = None
    audio_enabled: bool | None = None
    hints_enabled: bool | None = None
    show_images: bool | None = None
    show_objectives: bool | None = None
    show_problem_statement: bool | None = None

    # Time limit (denormalized, 0 = no limit)
    time_limit_seconds: int | None = None
    # Negative time flag (allows timer to go negative)
    negative: bool | None = None

    # Chat metadata (top-level, position/is_current derived in service layer)
    created_at: datetime | None = None
    completed: bool = False

    # Grade (composite type - no id, no rubric points)
    grade: GradeItem | None = None

    # Feedbacks
    feedbacks: list[FeedbackItem] | None = None

    # Analyses
    analyses: list[AnalysisItem] | None = None

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

    # Rubric/Grade resource IDs
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class GetChatsRequest(BaseModel):
    """Request for getting chat data."""

    attempt_id: UUID = Field(description="Attempt ID to fetch chats for")


class GetChatsResponse(BaseModel):
    """Response containing chat data."""

    items: list[ChatViewItem] = Field(
        default_factory=list, description="Chat data items"
    )
