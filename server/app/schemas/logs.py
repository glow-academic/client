"""Logs V2 API schemas (read-only)."""

from typing import List, Optional

from pydantic import BaseModel

# ============================================================================
# JSONB FIELD SCHEMAS
# ============================================================================


class ActorData(BaseModel):
    """Actor JSONB data."""

    userId: Optional[str] = None
    profileId: Optional[str] = None
    profileName: Optional[str] = None


class SubjectData(BaseModel):
    """Subject JSONB data."""

    entityId: Optional[str] = None
    entityType: Optional[str] = None


class MetricsData(BaseModel):
    """Metrics JSONB data."""

    size: Optional[int] = None
    count: Optional[int] = None
    durationMs: Optional[int] = None


class ContextData(BaseModel):
    """Context JSONB data."""

    route: Optional[str] = None
    function: Optional[str] = None
    component: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


class ErrorData(BaseModel):
    """Error JSONB data."""

    code: Optional[str] = None
    name: Optional[str] = None
    stack: Optional[str] = None
    message: Optional[str] = None


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class LogsListRequest(BaseModel):
    """Request for logs list."""

    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class LogItem(BaseModel):
    """Log item for list view."""

    log_id: int
    event: str
    level: str
    message: Optional[str]
    correlation_id: Optional[str]
    actor: Optional[ActorData]
    subject: Optional[SubjectData]
    metrics: Optional[MetricsData]
    context: Optional[ContextData]
    error: Optional[ErrorData]
    created_at: str
    actor_name: Optional[str]


class LogsListResponse(BaseModel):
    """Response for logs list."""

    logs: List[LogItem]

