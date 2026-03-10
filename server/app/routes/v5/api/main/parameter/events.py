"""Parameter event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

PARAMETER_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.parameter.viewed",),
        scope="entity",
        entity_key="parameter_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.parameter.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

PARAMETER_EVENTS = ArtifactEventsConfig(
    artifact="parameter",
    operations=PARAMETER_EVENT_CONFIGS,
)


def get_parameter_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a parameter operation."""
    return PARAMETER_EVENTS.get_operation(operation)
