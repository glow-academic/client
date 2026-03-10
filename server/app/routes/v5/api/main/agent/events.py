"""Agent event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

AGENT_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.agent.viewed",),
        scope="entity",
        entity_key="agent_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.agent.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

AGENT_EVENTS = ArtifactEventsConfig(
    artifact="agent",
    operations=AGENT_EVENT_CONFIGS,
)


def get_agent_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for an agent operation."""
    return AGENT_EVENTS.get_operation(operation)
