"""Benchmark event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    require_authenticated_profile,
)

BENCHMARK_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("benchmark.viewed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("benchmark.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

BENCHMARK_EVENTS = ArtifactEventsConfig(
    artifact="benchmark",
    operations=BENCHMARK_EVENT_CONFIGS,
)


def get_benchmark_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for a benchmark operation."""
    return BENCHMARK_EVENTS.get_operation(operation)
