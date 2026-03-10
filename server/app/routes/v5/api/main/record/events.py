"""Record event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

RECORD_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.record.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.record.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

RECORD_EVENTS = ArtifactEventsConfig(
    artifact="record",
    operations=RECORD_EVENT_CONFIGS,
)


def get_record_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a record operation."""
    return RECORD_EVENTS.get_operation(operation)
