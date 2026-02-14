"""Typed event models for groups resource generation."""

from typing import Any

from pydantic import BaseModel


class GroupsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: groups_generation_complete."""

    artifact_type: str
    resource_type: str = "groups"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
