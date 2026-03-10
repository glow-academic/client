"""Leaderboard event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

LEADERBOARD_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.leaderboard.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.leaderboard.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

LEADERBOARD_EVENTS = ArtifactEventsConfig(
    artifact="leaderboard",
    operations=LEADERBOARD_EVENT_CONFIGS,
)


def get_leaderboard_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a leaderboard operation."""
    return LEADERBOARD_EVENTS.get_operation(operation)
