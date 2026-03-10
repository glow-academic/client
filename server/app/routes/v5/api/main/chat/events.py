"""Chat event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

CHAT_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.chat.viewed",),
        scope="entity",
        entity_key="chat_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.chat.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

CHAT_EVENTS = ArtifactEventsConfig(
    artifact="chat",
    operations=CHAT_EVENT_CONFIGS,
)


def get_chat_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a chat operation."""
    return CHAT_EVENTS.get_operation(operation)
