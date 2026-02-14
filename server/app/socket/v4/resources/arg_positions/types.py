"""Typed event models for arg_positions resource generation."""

from typing import Any

from pydantic import BaseModel


class ArgPositionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: arg_positions_generation_complete."""

    artifact_type: str
    resource_type: str = "arg_positions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
