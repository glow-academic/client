"""Typed event models for args resource generation."""

from typing import Any

from pydantic import BaseModel


class ArgsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: args_generation_complete."""

    artifact_type: str
    resource_type: str = "args"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
