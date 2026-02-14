"""Typed event models for routes resource generation."""

from typing import Any

from pydantic import BaseModel


class RoutesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: routes_generation_complete."""

    artifact_type: str
    resource_type: str = "routes"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
