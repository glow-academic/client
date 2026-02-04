"""Types for activity audits view (mv_activity_audits)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityAuditItem(BaseModel):
    """Single audit row from mv_activity_audits."""

    audit_id: UUID
    created_at: datetime | None = None
    endpoint: str | None = None
    message: str | None = None
    error: bool = False
    session_id: UUID | None = None
    profile_id: UUID | None = None


class GetActivityAuditsRequest(BaseModel):
    """Request for activity audits view."""

    profile_id: UUID | None = Field(default=None)
    session_id: UUID | None = Field(default=None)
    error: bool | None = Field(default=None)
    endpoint: str | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    sort_order: str = Field(default="desc")
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class GetActivityAuditsResponse(BaseModel):
    """Response for activity audits view."""

    items: list[ActivityAuditItem] = Field(default_factory=list)
    total_count: int = 0
