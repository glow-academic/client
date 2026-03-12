"""Test event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    default_filter_events,
    require_authenticated_profile,
)

TEST_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events={"artifacts.test.viewed": None},
        scope="entity",
        entity_key="test_id",
        can_subscribe=require_authenticated_profile,
    ),
    "start": OperationEventConfig(
        operation="start",
        domain_events={"artifacts.test.started": None},
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "run": OperationEventConfig(
        operation="run",
        domain_events={
            "artifacts.test.run.started": None,
            "artifacts.test.run.progress": None,
            "artifacts.test.run.completed": None,
        },
        scope="entity",
        entity_key="invocation_id",
        can_subscribe=require_authenticated_profile,
        filter_events=default_filter_events,
    ),
    "end": OperationEventConfig(
        operation="end",
        domain_events={"artifacts.test.ended": None},
        scope="entity",
        entity_key="invocation_id",
        can_subscribe=require_authenticated_profile,
    ),
    "stop": OperationEventConfig(
        operation="stop",
        domain_events={"artifacts.test.stopped": None},
        scope="entity",
        entity_key="invocation_id",
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events={"artifacts.test.refreshed": None},
        scope="collection",
        entity_key=None,
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
