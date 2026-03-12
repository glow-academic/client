"""Group event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    default_filter_events,
    require_authenticated_profile,
)

GROUP_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events={"artifacts.group.viewed": None},
        scope="entity",
        entity_key="group_id",
        can_subscribe=require_authenticated_profile,
    ),
    "generate": OperationEventConfig(
        operation="generate",
        domain_events={
            "artifacts.group.generation.started": None,
            "artifacts.group.generation.progress": None,
            "artifacts.group.generation.completed": None,
        },
        scope="entity",
        entity_key="group_id",
        can_subscribe=require_authenticated_profile,
        filter_events=default_filter_events,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events={"artifacts.group.refreshed": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

GROUP_EVENTS = ArtifactEventsConfig(
    artifact="group",
    operations=GROUP_EVENT_CONFIGS,
)


def get_group_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a group operation."""
    return GROUP_EVENTS.get_operation(operation)
