"""Shared event declaration types for centralized delivery."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

EventScope = Literal["entity", "collection"]
EventRecord = dict[str, Any]
EventPayload = dict[str, Any]
LifecyclePhase = Literal["started", "completed", "failed"]

CanSubscribe = Callable[..., Awaitable[bool]]
FilterEvents = Callable[[UUID, list[EventRecord]], Awaitable[list[EventRecord]]]
ResolveEntityIds = Callable[[EventPayload, EventPayload], list[UUID]]


def build_lifecycle_event_type(
    artifact: str,
    operation: str,
    phase: LifecyclePhase,
) -> str:
    """Build the canonical public lifecycle event name."""
    return f"artifacts.{artifact}.{operation}.{phase}"


def build_default_lifecycle_event_types(
    artifact: str,
    operation: str,
) -> tuple[str, str, str]:
    """Build the canonical lifecycle event names for an operation."""
    return (
        build_lifecycle_event_type(artifact, operation, "started"),
        build_lifecycle_event_type(artifact, operation, "completed"),
        build_lifecycle_event_type(artifact, operation, "failed"),
    )


@dataclass(frozen=True)
class OperationEventConfig:
    """Declarative event policy for a single artifact operation."""

    operation: str
    domain_events: tuple[str, ...]
    scope: EventScope
    entity_key: str | None
    can_subscribe: CanSubscribe
    filter_events: FilterEvents | None = None
    include_call_lifecycle: bool = True
    resolve_entity_ids: ResolveEntityIds | None = None


@dataclass(frozen=True)
class ArtifactEventsConfig:
    """Declarative event policy bundle for an artifact."""

    artifact: str
    operations: dict[str, OperationEventConfig]
    @property
    def event_types(self) -> tuple[str, ...]:
        """Flatten domain and lifecycle event types for the artifact."""
        return tuple(
            dict.fromkeys(
                event_type
                for operation in self.operations.values()
                for event_type in (
                    *operation.domain_events,
                    *(
                        build_default_lifecycle_event_types(
                            self.artifact,
                            operation.operation,
                        )
                        if operation.include_call_lifecycle
                        else ()
                    ),
                )
            )
        )

    def get_operation(self, operation: str) -> OperationEventConfig | None:
        """Resolve a single operation config."""
        return self.operations.get(operation)


async def default_filter_events(
    profile_id: UUID,
    events: list[EventRecord],
) -> list[EventRecord]:
    """Default no-op filter for artifacts without redaction rules yet."""
    del profile_id
    return events


async def require_authenticated_profile(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    entity_id: UUID | None = None,
    session_id: UUID | None = None,
    event_types: list[str] | None = None,
) -> bool:
    """Placeholder auth check for artifacts that only need a resolved profile."""
    from app.infra.profile_identity_context import resolve_profile_identity_context

    del entity_id, event_types
    profile = await resolve_profile_identity_context(
        pool,
        profile_id,
        redis,
        session_id=session_id,
    )
    return profile is not None
