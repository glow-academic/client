"""Field event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

FIELD_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.field.viewed",),
        scope="entity",
        entity_key="field_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.field.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

FIELD_EVENTS = ArtifactEventsConfig(
    artifact="field",
    operations=FIELD_EVENT_CONFIGS,
)


def get_field_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a field operation."""
    return FIELD_EVENTS.get_operation(operation)
