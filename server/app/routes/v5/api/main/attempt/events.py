"""Attempt event declarations for centralized delivery."""

from app.events.types import (
    ArtifactEventsConfig,
    OperationEventConfig,
    default_filter_events,
    require_authenticated_profile,
)

ATTEMPT_EVENT_CONFIGS: dict[str, OperationEventConfig] = {
    "get": OperationEventConfig(
        operation="get",
        domain_events=("artifacts.attempt.viewed",),
        scope="entity",
        entity_key="attempt_id",
        can_subscribe=require_authenticated_profile,
    ),
    "start": OperationEventConfig(
        operation="start",
        domain_events=("artifacts.attempt.started",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
    "message": OperationEventConfig(
        operation="message",
        domain_events=(
            "artifacts.attempt.assistant.start",
            "artifacts.attempt.assistant.progress",
            "artifacts.attempt.assistant.complete",
        ),
        scope="entity",
        entity_key="chat_id",
        can_subscribe=require_authenticated_profile,
        filter_events=default_filter_events,
    ),
    "grade": OperationEventConfig(
        operation="grade",
        domain_events=(
            "artifacts.attempt.grade.start",
            "artifacts.attempt.grade.progress",
            "artifacts.attempt.grade.complete",
        ),
        scope="entity",
        entity_key="attempt_id",
        can_subscribe=require_authenticated_profile,
        filter_events=default_filter_events,
    ),
    "end": OperationEventConfig(
        operation="end",
        domain_events=("artifacts.attempt.ended",),
        scope="entity",
        entity_key="attempt_id",
        can_subscribe=require_authenticated_profile,
    ),
    "response": OperationEventConfig(
        operation="response",
        domain_events=("artifacts.attempt.response.saved",),
        scope="entity",
        entity_key="attempt_id",
        can_subscribe=require_authenticated_profile,
    ),
    "audio": OperationEventConfig(
        operation="audio",
        domain_events=(
            "artifacts.attempt.audio.start",
            "artifacts.attempt.audio.progress",
            "artifacts.attempt.audio.complete",
        ),
        scope="entity",
        entity_key="attempt_id",
        can_subscribe=require_authenticated_profile,
        filter_events=default_filter_events,
    ),
    "refresh": OperationEventConfig(
        operation="refresh",
        domain_events=("artifacts.attempt.refreshed",),
        scope="collection",
        entity_key=None,
        can_subscribe=require_authenticated_profile,
    ),
}

ATTEMPT_EVENTS = ArtifactEventsConfig(
    artifact="attempt",
    operations=ATTEMPT_EVENT_CONFIGS,
)


def get_attempt_event_config(operation: str) -> OperationEventConfig | None:
    """Resolve event policy for an attempt operation."""
    return ATTEMPT_EVENTS.get_operation(operation)
