"""Types for grant list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class GrantViewItem(BaseModel):
    """Single grant from the grant list view."""

    grant_id: UUID
    grantor_id: UUID | None = None
    emulation_id: UUID | None = None
    emulated_id: UUID | None = None
    grant_session_id: UUID | None = None
    emulation_session_id: UUID | None = None
    expires_at: datetime | None = None
    used_at: datetime | None = None
    revoked_at: datetime | None = None
    created_at: datetime | None = None


class GetGrantListViewResponse(BaseModel):
    """Response containing grant list data."""

    items: list[GrantViewItem] = Field(
        default_factory=list, description="Grant data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
