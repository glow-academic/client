"""Typed event models for endpoints resource generation."""

from typing import Any

from pydantic import BaseModel


class EndpointsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: endpoints_generation_complete."""

    artifact_type: str
    resource_type: str = "endpoints"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
