"""Rubric event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

RUBRIC_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.rubric.viewed",),
        scope="entity",
        entity_key="rubric_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.rubric.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

RUBRIC_EVENTS = ArtifactEventsConfig(
    artifact="rubric",
    operations=RUBRIC_EVENT_CONFIGS,
)


def get_rubric_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a rubric operation."""
    return RUBRIC_EVENTS.get_operation(operation)
