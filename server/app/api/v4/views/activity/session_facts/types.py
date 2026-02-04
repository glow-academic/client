"""Types for activity session facts view (mv_activity_session_facts)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class ActivitySessionFactsItem(BaseModel):
    """Single session from mv_activity_session_facts."""

    session_id: UUID
    profile_id: UUID | None = None

    session_created_at: datetime | None = None
    session_updated_at: datetime | None = None

    active: bool = False

    group_count: int = 0
    first_group_at: datetime | None = None
    last_group_at: datetime | None = None

    run_count: int = 0
    total_tokens: int = 0


class GetActivitySessionFactsRequest(BaseModel):
    """Request for getting activity session facts."""

    profile_id: UUID | None = Field(default=None)
    active: bool | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    sort_by: str = Field(
        default="date", description="'date' | 'groups' | 'runs' | 'tokens'"
    )
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetActivitySessionFactsResponse(BaseModel):
    """Response with activity session facts."""

    items: list[ActivitySessionFactsItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
