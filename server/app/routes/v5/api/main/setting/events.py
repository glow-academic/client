"""Setting event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

SETTING_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("setting.viewed",),
        scope="entity",
        entity_key="setting_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("setting.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

SETTING_EVENTS = ArtifactEventsConfig(
    artifact="setting",
    operations=SETTING_EVENT_CONFIGS,
)


def get_setting_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a setting operation."""
    return SETTING_EVENTS.get_operation(operation)
