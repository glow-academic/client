"""Pricing event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

PRICING_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events={"artifacts.pricing.viewed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events={"artifacts.pricing.refreshed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

PRICING_EVENTS = ArtifactEventsConfig(
    artifact="pricing",
    operations=PRICING_EVENT_CONFIGS,
)


def get_pricing_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a pricing operation."""
    return PRICING_EVENTS.get_operation(operation)
