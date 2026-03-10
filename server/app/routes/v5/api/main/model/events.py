"""Model event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

MODEL_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("model.viewed",),
        scope="entity",
        entity_key="model_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("model.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

MODEL_EVENTS = ArtifactEventsConfig(
    artifact="model",
    operations=MODEL_EVENT_CONFIGS,
)


def get_model_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a model operation."""
    return MODEL_EVENTS.get_operation(operation)
