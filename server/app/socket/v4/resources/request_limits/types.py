"""Typed event models for request_limits resource generation."""

from typing import Any

from pydantic import BaseModel


class RequestLimitsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: request_limits_generation_complete."""

    artifact_type: str
    resource_type: str = "request_limits"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
