"""Typed event models for pricing resource generation."""

from typing import Any

from pydantic import BaseModel


class PricingGenerationCompleteEvent(BaseModel):
    """Server-to-client event: pricing_generation_complete."""

    artifact_type: str
    resource_type: str = "pricing"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
