"""Document event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

DOCUMENT_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.document.viewed",),
        scope="entity",
        entity_key="document_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.document.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

DOCUMENT_EVENTS = ArtifactEventsConfig(
    artifact="document",
    operations=DOCUMENT_EVENT_CONFIGS,
)


def get_document_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a document operation."""
    return DOCUMENT_EVENTS.get_operation(operation)
