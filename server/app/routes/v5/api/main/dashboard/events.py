"""Dashboard event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

DASHBOARD_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("dashboard.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("dashboard.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

DASHBOARD_EVENTS = ArtifactEventsConfig(
    artifact="dashboard",
    operations=DASHBOARD_EVENT_CONFIGS,
)


def get_dashboard_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a dashboard operation."""
    return DASHBOARD_EVENTS.get_operation(operation)
