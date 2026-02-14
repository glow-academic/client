"""Typed event models for bindings resource generation."""

from typing import Any

from pydantic import BaseModel


class BindingsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: bindings_generation_complete."""

    artifact_type: str
    resource_type: str = "bindings"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
