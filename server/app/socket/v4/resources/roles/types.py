"""Typed event models for roles resource generation."""

from typing import Any

from pydantic import BaseModel


class RolesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: roles_generation_complete."""

    artifact_type: str
    resource_type: str = "roles"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
