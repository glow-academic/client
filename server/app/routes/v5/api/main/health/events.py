"""Health event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

HEALTH_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("health.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("health.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

HEALTH_EVENTS = ArtifactEventsConfig(
    artifact="health",
    operations=HEALTH_EVENT_CONFIGS,
)


def get_health_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a health operation."""
    return HEALTH_EVENTS.get_operation(operation)
