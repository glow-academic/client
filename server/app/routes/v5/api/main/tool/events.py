"""Tool event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

TOOL_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("tool.viewed",),
        scope="entity",
        entity_key="tool_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("tool.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

TOOL_EVENTS = ArtifactEventsConfig(
    artifact="tool",
    operations=TOOL_EVENT_CONFIGS,
)


def get_tool_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a tool operation."""
    return TOOL_EVENTS.get_operation(operation)
