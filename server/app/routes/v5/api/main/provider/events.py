"""Provider event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

PROVIDER_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("provider.viewed",),
        scope="entity",
        entity_key="provider_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("provider.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

PROVIDER_EVENTS = ArtifactEventsConfig(
    artifact="provider",
    operations=PROVIDER_EVENT_CONFIGS,
)


def get_provider_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a provider operation."""
    return PROVIDER_EVENTS.get_operation(operation)
