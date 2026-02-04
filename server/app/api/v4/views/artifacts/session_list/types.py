"""Types for artifact session list view (mv_artifact_session_list)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ArtifactSessionListItem(BaseModel):
    """Single session from mv_artifact_session_list."""

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


class GetArtifactSessionListRequest(BaseModel):
    """Request for getting artifact session list."""

    profile_id: UUID | None = Field(default=None)
    active: bool | None = Field(default=None)
    date_from: datetime | None = Field(default=None)
    date_to: datetime | None = Field(default=None)

    sort_by: str = Field(default="date", description="'date' | 'cost' | 'tokens' | 'groups' | 'runs'")
    sort_order: str = Field(default="desc")

    page_limit: int = Field(default=50, ge=1, le=100)
    page_offset: int = Field(default=0, ge=0)


class GetArtifactSessionListResponse(BaseModel):
    """Response with artifact session list."""

    items: list[ArtifactSessionListItem] = Field(default_factory=list)
    total_count: int = Field(default=0)
