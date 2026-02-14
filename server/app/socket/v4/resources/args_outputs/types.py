"""Typed event models for args_outputs resource generation."""

from typing import Any

from pydantic import BaseModel


class ArgsOutputsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: args_outputs_generation_complete."""

    artifact_type: str
    resource_type: str = "args_outputs"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
