"""Typed event models for pricing resource socket events."""

from typing import Any

from pydantic import BaseModel


class PricingGenerationStartedEvent(BaseModel):
    """Server-to-client event: pricing_generation_started."""

    artifact_type: str
    resource_type: str = "pricing"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class PricingGenerationProgressEvent(BaseModel):
    """Server-to-client event: pricing_generation_progress."""

    artifact_type: str
    resource_type: str = "pricing"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class PricingGenerationCompleteEvent(BaseModel):
    """Server-to-client event: pricing_generation_complete."""

    artifact_type: str
    resource_type: str = "pricing"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    pricing_type: str | None = None
    price: float | None = None
    unit_id: str | None = None
    generated: bool | None = None


class PricingGenerationErrorEvent(BaseModel):
    """Server-to-client event: pricing_generation_error."""

    artifact_type: str
    resource_type: str = "pricing"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
