"""Feedback V2 API schemas."""


from pydantic import BaseModel

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class FeedbackListRequest(BaseModel):
    """Request for feedback list."""

    profileId: str


class CreateFeedbackRequest(BaseModel):
    """Request for creating app feedback."""

    type: str  # 'feature', 'bug', 'question', 'other'
    message: str
    profileId: str  # Author profile ID


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class FeedbackItem(BaseModel):
    """Feedback item for list view."""

    feedback_id: int
    type: str  # 'feature', 'bug', 'question', 'other'
    message: str
    created_at: str
    author_name: str
    author_alias: str
    author_profile_id: str


class FeedbackListResponse(BaseModel):
    """Response for feedback list."""

    feedback: list[FeedbackItem]


class CreateFeedbackResponse(BaseModel):
    """Response for creating app feedback."""

    feedback_id: int
    success: bool
    message: str
