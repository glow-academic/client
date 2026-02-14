"""Typed event models for run_rubrics resource generation."""

from typing import Any

from pydantic import BaseModel


class RunRubricsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: run_rubrics_generation_complete."""

    artifact_type: str
    resource_type: str = "run_rubrics"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
