"""Department event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

DEPARTMENT_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("department.viewed",),
        scope="entity",
        entity_key="department_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("department.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

DEPARTMENT_EVENTS = ArtifactEventsConfig(
    artifact="department",
    operations=DEPARTMENT_EVENT_CONFIGS,
)


def get_department_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a department operation."""
    return DEPARTMENT_EVENTS.get_operation(operation)
