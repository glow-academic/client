"""Invocation event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

INVOCATION_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events={"artifacts.invocation.viewed": None},
        scope="entity",
        entity_key="test_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events={"artifacts.invocation.refreshed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

INVOCATION_EVENTS = ArtifactEventsConfig(
    artifact="invocation",
    operations=INVOCATION_EVENT_CONFIGS,
)


def get_invocation_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for an invocation operation."""
    return INVOCATION_EVENTS.get_operation(operation)
