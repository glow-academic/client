"""Typed event models for role_routes resource generation."""

from typing import Any

from pydantic import BaseModel


class RoleRoutesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: role_routes_generation_complete."""

    artifact_type: str
    resource_type: str = "role_routes"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
