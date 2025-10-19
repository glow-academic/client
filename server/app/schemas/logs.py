"""Logs V2 API schemas."""

from typing import Any

from pydantic import BaseModel

# ============================================================================
# JSONB FIELD SCHEMAS
# ============================================================================


class ActorData(BaseModel):
    """Actor JSONB data."""

    userId: str | None = None
    profileId: str | None = None
    profileName: str | None = None


class SubjectData(BaseModel):
    """Subject JSONB data."""

    entityId: str | None = None
    entityType: str | None = None


class MetricsData(BaseModel):
    """Metrics JSONB data."""

    size: int | None = None
    count: int | None = None
    durationMs: int | None = None


class ContextData(BaseModel):
    """Context JSONB data."""

    route: str | None = None
    function: str | None = None
    component: str | None = None
    provider: str | None = None
    model: str | None = None


class ErrorData(BaseModel):
    """Error JSONB data."""

    code: str | None = None
    name: str | None = None
    stack: str | None = None
    message: str | None = None


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
    message: str
    correlation_id: str
    actor: ActorData
    subject: SubjectData
    context: ContextData
    error: ErrorData
    created_at: str
    actor_name: str | None


class LogsListResponse(BaseModel):
    """Response for logs list."""

    logs: list[LogItem]


# ============================================================================
# CREATE LOG SCHEMAS
# ============================================================================


class CorrelationData(BaseModel):
    """Correlation data for log creation."""

    correlationId: str | None = None
    requestId: str | None = None
    sessionId: str | None = None
    attemptId: str | None = None
    chatId: str | None = None


class CreateLogRequest(BaseModel):
    """Request to create a log entry."""

    event: str = "legacy.message"
    level: str = "info"
    message: str = "Default Message"
    correlation: CorrelationData = CorrelationData()
    actor: dict[str, Any] = {}
    subject: dict[str, Any] = {}
    context: dict[str, Any] = {}
    error: dict[str, Any] = {}


class CreateLogResponse(BaseModel):
    """Response from creating a log entry."""

    success: bool
    log_id: int | None = None


# ============================================================================
# BULK DELETE LOG SCHEMAS
# ============================================================================


class BulkDeleteLogsRequest(BaseModel):
    """Request to bulk delete logs."""

    profileId: str
    ids: list[int]


class BulkDeleteLogsResponse(BaseModel):
    """Response for bulk delete logs."""

    success: bool
    deleted_count: int
    message: str
