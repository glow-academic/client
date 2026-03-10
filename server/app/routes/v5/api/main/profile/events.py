"""Profile event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

PROFILE_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("profile.viewed",),
        scope="entity",
        entity_key="target_profile_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("profile.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

PROFILE_EVENTS = ArtifactEventsConfig(
    artifact="profile",
    operations=PROFILE_EVENT_CONFIGS,
)


def get_profile_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a profile operation."""
    return PROFILE_EVENTS.get_operation(operation)
