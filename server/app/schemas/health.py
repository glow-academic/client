"""Health check schemas for system monitoring."""

from typing import Literal

from pydantic import BaseModel


class HealthCheckItem(BaseModel):
    """Individual health check result."""

    id: str
    name: str
    description: str
    status: Literal["healthy", "unhealthy", "warning", "n/a"]
    response_time: int | None  # milliseconds
    last_checked: str  # ISO timestamp
    message: str | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    """Overall system health response."""

    status: Literal["healthy", "degraded", "unhealthy"]
    checks: list[HealthCheckItem]
    timestamp: str  # ISO timestamp
    overall_response_time: int  # milliseconds
