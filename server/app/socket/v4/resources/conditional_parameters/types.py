"""Typed event models for conditional_parameters resource generation."""

from typing import Any

from pydantic import BaseModel


class ConditionalParametersGenerationCompleteEvent(BaseModel):
    """Server-to-client event: conditional_parameters_generation_complete."""

    artifact_type: str
    resource_type: str = "conditional_parameters"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
