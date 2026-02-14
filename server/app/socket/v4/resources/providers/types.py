"""Typed event models for providers resource generation."""

from typing import Any

from pydantic import BaseModel


class ProvidersGenerationCompleteEvent(BaseModel):
    """Server-to-client event: providers_generation_complete."""

    artifact_type: str
    resource_type: str = "providers"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
