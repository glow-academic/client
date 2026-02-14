"""Typed event models for domains resource generation."""

from typing import Any

from pydantic import BaseModel


class DomainsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: domains_generation_complete."""

    artifact_type: str
    resource_type: str = "domains"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
