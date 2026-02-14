"""Typed event models for values resource generation."""

from typing import Any

from pydantic import BaseModel


class ValuesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: values_generation_complete."""

    artifact_type: str
    resource_type: str = "values"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
