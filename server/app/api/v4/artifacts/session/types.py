"""Types for session artifact endpoints."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.artifacts.session_detail.types import (
    ArtifactSessionAudit,
    ArtifactSessionGroup,
)


class SessionListItem(BaseModel):
    """Single session in the list response with hydrated metadata."""

    session_id: UUID
    profile_id: UUID | None = None
    profile_name: str | None = None

    session_created_at: datetime | None = None
    session_updated_at: datetime | None = None

    active: bool = False

    group_count: int = 0
    run_count: int = 0
    first_run_at: datetime | None = None
    last_run_at: datetime | None = None

    total_tokens: int = 0
    total_cost: Decimal = Decimal("0")

    audit_count: int = 0
    last_audit_at: datetime | None = None
    error_count: int = 0


class GetSessionListRequest(BaseModel):
    """Request for session list endpoint."""

    active: bool | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    sort_by: str = Field(
        default="date", description="'date' | 'cost' | 'tokens' | 'groups' | 'runs'"
    )
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetSessionListResponse(BaseModel):
    """Response for session list endpoint."""

    actor_name: str | None = None
    items: list[SessionListItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
    page: int = Field(default=0)
    page_size: int = Field(default=50)
    total_pages: int = Field(default=0)


class GetSessionDetailRequest(BaseModel):
    """Request for session detail endpoint."""

    session_id: UUID
    audit_limit: int = Field(default=50, ge=1, le=200)
    audit_offset: int = Field(default=0, ge=0)


class GetSessionDetailResponse(BaseModel):
    """Response for session detail endpoint."""

    actor_name: str | None = None
    session_exists: bool = False
    session_id: UUID | None = None
    profile_id: UUID | None = None
    profile_name: str | None = None
    session_created_at: datetime | None = None
    active: bool = False
    audit_total_count: int = 0
    audits: list[ArtifactSessionAudit] = Field(default_factory=list)
    groups: list[ArtifactSessionGroup] = Field(default_factory=list)
