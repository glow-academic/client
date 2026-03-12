"""Session event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

SESSION_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events={"artifacts.session.viewed": None},
        scope="entity",
        entity_key="session_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events={"artifacts.session.refreshed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

SESSION_EVENTS = ArtifactEventsConfig(
    artifact="session",
    operations=SESSION_EVENT_CONFIGS,
)


def get_session_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a session operation."""
    return SESSION_EVENTS.get_operation(operation)
