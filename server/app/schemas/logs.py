"""Logs V2 API schemas."""

from typing import Any, Dict, List, Optional

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
    context: Optional[ContextData]
    error: Optional[ErrorData]
    created_at: str
    actor_name: Optional[str]


class LogsListResponse(BaseModel):
    """Response for logs list."""

    logs: List[LogItem]


# ============================================================================
# CREATE LOG SCHEMAS
# ============================================================================


class CorrelationData(BaseModel):
    """Correlation data for log creation."""

    correlationId: Optional[str] = None
    requestId: Optional[str] = None
    sessionId: Optional[str] = None
    attemptId: Optional[str] = None
    chatId: Optional[str] = None


class CreateLogRequest(BaseModel):
    """Request to create a log entry."""

    event: Optional[str] = "legacy.message"
    level: Optional[str] = "info"
    message: Optional[str] = None
    correlation: Optional[CorrelationData] = None
    actor: Optional[Dict[str, Any]] = None
    subject: Optional[Dict[str, Any]] = None
    context: Optional[Dict[str, Any]] = None
    error: Optional[Dict[str, Any]] = None


class CreateLogResponse(BaseModel):
    """Response from creating a log entry."""

    success: bool
    log_id: Optional[int] = None


# ============================================================================
# BULK DELETE LOG SCHEMAS
# ============================================================================


class BulkDeleteLogsRequest(BaseModel):
    """Request to bulk delete logs."""

    profileId: str
    ids: List[int]


class BulkDeleteLogsResponse(BaseModel):
    """Response for bulk delete logs."""

    success: bool
    deleted_count: int
    message: str

