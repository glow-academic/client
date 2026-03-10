"""Eval event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

EVAL_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.eval.viewed",),
        scope="entity",
        entity_key="eval_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.eval.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

EVAL_EVENTS = ArtifactEventsConfig(
    artifact="eval",
    operations=EVAL_EVENT_CONFIGS,
)


def get_eval_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for an eval operation."""
    return EVAL_EVENTS.get_operation(operation)
