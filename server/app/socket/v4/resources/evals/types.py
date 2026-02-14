"""Typed event models for evals resource generation."""

from typing import Any

from pydantic import BaseModel


class EvalsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: evals_generation_complete."""

    artifact_type: str
    resource_type: str = "evals"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
