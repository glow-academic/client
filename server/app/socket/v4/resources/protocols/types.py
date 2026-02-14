"""Typed event models for protocols resource generation."""

from typing import Any

from pydantic import BaseModel


class ProtocolsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: protocols_generation_complete."""

    artifact_type: str
    resource_type: str = "protocols"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
