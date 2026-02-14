"""Typed event models for standard_groups resource generation."""

from typing import Any

from pydantic import BaseModel


class StandardGroupsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: standard_groups_generation_complete."""

    artifact_type: str
    resource_type: str = "standard_groups"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
