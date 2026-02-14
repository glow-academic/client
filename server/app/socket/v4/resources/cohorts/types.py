"""Typed event models for cohorts resource generation."""

from typing import Any

from pydantic import BaseModel


class CohortsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: cohorts_generation_complete."""

    artifact_type: str
    resource_type: str = "cohorts"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
