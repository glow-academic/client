"""WebSocket-specific types for pricing generation.

Extends base artifact types with pricing-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from pydantic import BaseModel

from app.api.v4.artifacts.pricing.types import GetPricingApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

# Pricing has no resource types (operational view — generation produces runs/insights)
PRICING_RESOURCE_TYPES: list[str] = []

PRICING_SYNC_ENTRY_TYPES = ["runs"]

PRICING_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]

# =============================================================================
# Client-to-Server Events (pricing_generate)
# =============================================================================


class GeneratePricingPayload(GetPricingApiRequest):
    """Request payload for pricing_generate WebSocket event.

    Extends GetPricingApiRequest (which has pricing_id, draft_id)
    with generation-specific fields.
    """

    # Generation-specific fields
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions
    save: bool = True  # Whether to auto-save on completion


# =============================================================================
# Server-to-Client Events
# =============================================================================


class PricingGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: pricing_generation_complete.

    Emitted when all agents have finished generating pricing resources.
    """

    artifact_type: str = "pricing"
    pricing_id: str | None = None


class PricingGenerationProgressEvent(BaseModel):
    """Server-to-client event: pricing_generation_progress.

    Emitted as individual resources complete, providing percentage progress.
    """

    artifact_type: str = "pricing"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int  # 0-100
    last_completed_resource: str | None = None


class PricingGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: pricing_generation_error.

    Emitted when pricing resource generation fails.
    """

    artifact_type: str = "pricing"
