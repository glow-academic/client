"""Typed event models for group_rubrics resource generation."""

from typing import Any

from pydantic import BaseModel


class GroupRubricsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: group_rubrics_generation_complete."""

    artifact_type: str
    resource_type: str = "group_rubrics"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
