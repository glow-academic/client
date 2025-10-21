"""Pricing analytics schemas."""

from pydantic import BaseModel


class DebugInfoItem(BaseModel):
    """Debug information item."""

    id: str
    created_at: str
    content: str


class ModelRunItem(BaseModel):
    """Model run item with aggregated metrics."""

    model_run_id: str
    created_at: str
    input_tokens: int
    output_tokens: int
    model_id: str | None = None
    profile_id: str | None = None
    agent_id: str | None = None
    persona_id: str | None = None
    debug_info: list[DebugInfoItem] | None = None


class ModelMappingWithPricing(BaseModel):
    """Model mapping with pricing information."""

    name: str
    description: str
    input_ppm: float
    output_ppm: float


class PricingAnalyticsResponse(BaseModel):
    """Response for pricing analytics."""

    model_runs: list[ModelRunItem]
    model_mapping: dict[str, ModelMappingWithPricing]
    profile_mapping: dict[str, str]
    agent_mapping: dict[str, str]
    persona_mapping: dict[str, str]
