"""Scenario event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

SCENARIO_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("scenario.viewed",),
        scope="entity",
        entity_key="scenario_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("scenario.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

SCENARIO_EVENTS = ArtifactEventsConfig(
    artifact="scenario",
    operations=SCENARIO_EVENT_CONFIGS,
)


def get_scenario_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a scenario operation."""
    return SCENARIO_EVENTS.get_operation(operation)
