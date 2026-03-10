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

CanSubscribe = Callable[..., Awaitable[bool]]
FilterEvents = Callable[[UUID, list[EventRecord]], Awaitable[list[EventRecord]]]


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


@dataclass(frozen=True)
class ArtifactEventsConfig:
    """Declarative event policy bundle for an artifact."""

    artifact: str
    operations: dict[str, OperationEventConfig]
    call_lifecycle_events: tuple[str, ...] = (
        "call.started",
        "call.completed",
        "call.failed",
    )

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
                        self.call_lifecycle_events
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
