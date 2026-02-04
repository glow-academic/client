"""Types for artifact session detail view (api_get_artifact_session_detail_v4)."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class ArtifactSessionAudit(BaseModel):
    """Single audit entry for a session."""

    id: UUID
    created_at: datetime | None = None
    message: str | None = None
    endpoint: str | None = None
    error: bool = False


class ArtifactSessionGroup(BaseModel):
    """Single group entry for a session."""

    group_id: UUID
    group_name: str | None = None
    trace_id: str | None = None
    first_run_at: datetime | None = None
    last_run_at: datetime | None = None
    run_count: int = 0
    total_tokens: int = 0
    total_cost: Decimal = Decimal("0")


class GetArtifactSessionDetailRequest(BaseModel):
    """Request for getting artifact session detail."""

    session_id: UUID
    audit_limit: int = Field(default=50, ge=1, le=200)
    audit_offset: int = Field(default=0, ge=0)


class GetArtifactSessionDetailResponse(BaseModel):
    """Response with artifact session detail."""

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
