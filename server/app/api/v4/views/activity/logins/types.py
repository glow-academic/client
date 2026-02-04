"""Types for activity logins view (mv_activity_logins)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivityLoginItem(BaseModel):
    """Single login from mv_activity_logins."""

    login_id: UUID
    profile_id: UUID | None = None
    last_login: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    active: bool = False
    call_id: UUID | None = None


class GetActivityLoginsRequest(BaseModel):
    """Request for activity logins view."""

    profile_id: UUID | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)
    active: bool | None = Field(default=None)
    sort_by: str = Field(default="last_login", description="'last_login' | 'created'")
    sort_order: str = Field(default="desc")
    page_limit: int = Field(default=50, ge=1, le=200)
    page_offset: int = Field(default=0, ge=0)


class GetActivityLoginsResponse(BaseModel):
    """Response for activity logins view."""

    items: list[ActivityLoginItem] = Field(default_factory=list)
    total_count: int = 0
