"""Types for login list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LoginViewItem(BaseModel):
    """Single login from the login list view."""

    login_id: UUID
    profile_id: UUID | None = None
    session_id: UUID | None = None
    last_login: datetime | None = None
    login_created_at: datetime | None = None
    active: bool | None = None
    generated: bool | None = None
    mcp: bool | None = None
    call_id: UUID | None = None


class GetLoginListViewResponse(BaseModel):
    """Response containing login list data."""

    items: list[LoginViewItem] = Field(
        default_factory=list, description="Login data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
