"""Cohort event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

COHORT_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("cohort.viewed",),
        scope="entity",
        entity_key="cohort_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("cohort.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

COHORT_EVENTS = ArtifactEventsConfig(
    artifact="cohort",
    operations=COHORT_EVENT_CONFIGS,
)


def get_cohort_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a cohort operation."""
    return COHORT_EVENTS.get_operation(operation)
