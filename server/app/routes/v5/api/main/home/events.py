"""Home event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

HOME_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.home.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.home.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

HOME_EVENTS = ArtifactEventsConfig(
    artifact="home",
    operations=HOME_EVENT_CONFIGS,
)


def get_home_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a home operation."""
    return HOME_EVENTS.get_operation(operation)
