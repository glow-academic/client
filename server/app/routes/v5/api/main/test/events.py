"""Test event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    default_filter_events,
    require_authenticated_profile,
)

TEST_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "start": OperationEventConfig(
        operation="start",
        domain_events=("test.started",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "run": OperationEventConfig(
        operation="run",
        domain_events=(
            "test.run.started",
            "test.run.progress",
            "test.run.completed",
        ),
        scope="entity",
        entity_key="invocation_id",
        can_subscribe=require_authenticated_profile,
        filter_events=default_filter_events,
    ),
    "end": OperationEventConfig(
        operation="end",
        domain_events=("test.ended",),
        scope="entity",
        entity_key="invocation_id",
        can_subscribe=require_authenticated_profile,
    ),
    "stop": OperationEventConfig(
        operation="stop",
        domain_events=("test.stopped",),
        scope="entity",
        entity_key="invocation_id",
        can_subscribe=require_authenticated_profile,
    ),
}

TEST_EVENTS = ArtifactEventsConfig(
    artifact="test",
    operations=TEST_EVENT_CONFIGS,
)


def get_test_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a test operation."""
    return TEST_EVENTS.get_operation(operation)
