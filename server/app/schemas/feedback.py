"""Feedback V2 API schemas (read-only)."""

from typing import List

from pydantic import BaseModel

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class FeedbackListRequest(BaseModel):
    """Request for feedback list."""

    profileId: str


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

    feedback: List[FeedbackItem]

