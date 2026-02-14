"""Types for audit list view."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AuditViewItem(BaseModel):
    """Single audit from the audit list view."""

    audit_id: UUID
    session_id: UUID | None = None
    audit_created_at: datetime | None = None
    message: str | None = None
    endpoint: str | None = None
    error: bool = False


class GetAuditListViewResponse(BaseModel):
    """Response containing audit list data."""

    items: list[AuditViewItem] = Field(
        default_factory=list, description="Audit data items"
    )
    total_count: int = Field(default=0, description="Total count before pagination")
