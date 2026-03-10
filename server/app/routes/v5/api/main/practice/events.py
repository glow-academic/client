"""Practice event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

PRACTICE_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.practice.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.practice.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

PRACTICE_EVENTS = ArtifactEventsConfig(
    artifact="practice",
    operations=PRACTICE_EVENT_CONFIGS,
)


def get_practice_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a practice operation."""
    return PRACTICE_EVENTS.get_operation(operation)
