"""WebSocket-specific types for pricing generation.

Extends base artifact types with pricing-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
)


class PricingGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: pricing_generation_complete."""

    artifact_type: str = "pricing"


class PricingGenerationProgressEvent(GenerationProgressEvent):
    """Server-to-client event: pricing_generation_progress."""

    artifact_type: str = "pricing"


class PricingGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: pricing_generation_error."""

    artifact_type: str = "pricing"
