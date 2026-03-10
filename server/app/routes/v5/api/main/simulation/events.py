"""Simulation event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

SIMULATION_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("simulation.viewed",),
        scope="entity",
        entity_key="simulation_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("simulation.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

SIMULATION_EVENTS = ArtifactEventsConfig(
    artifact="simulation",
    operations=SIMULATION_EVENT_CONFIGS,
)


def get_simulation_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a simulation operation."""
    return SIMULATION_EVENTS.get_operation(operation)
