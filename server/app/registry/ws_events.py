"""WebSocket event registry: input → output event mapping.

For each (artifact, operation) input event, defines the set of output
events that can be emitted. This serves as:

  1. Client contract — what to subscribe to for a given input event
  2. Audit trail — which output events were emitted during a call
  3. Documentation — single source of truth for the ws event schema

Canonical CRUD operations always emit the standard 4 lifecycle events:
  {artifact}.{operation}.started
  {artifact}.{operation}.progress
  {artifact}.{operation}.completed
  {artifact}.{operation}.failed

Orchestration operations (like attempt.start) emit a richer set of
domain-specific events in addition to or instead of the canonical 4.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class WsEventConfig:
    """Configuration for a single ws input event."""

    artifact: str
    operation: str
    output_events: list[str]

    @property
    def input_event(self) -> str:
        return f"{self.artifact}.{self.operation}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_LIFECYCLE = ["started", "progress", "completed", "failed"]


def _canonical(artifact: str, operation: str) -> WsEventConfig:
    """Standard CRUD operation — emits the 4 canonical lifecycle events."""
    return WsEventConfig(
        artifact=artifact,
        operation=operation,
        output_events=[f"{artifact}.{operation}.{phase}" for phase in _LIFECYCLE],
    )


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

WS_EVENTS: dict[tuple[str, str], WsEventConfig] = {}


def _register(config: WsEventConfig) -> None:
    WS_EVENTS[(config.artifact, config.operation)] = config


def _register_canonical(artifact: str, operations: list[str]) -> None:
    """Register a set of canonical CRUD operations for an artifact."""
    for op in operations:
        _register(_canonical(artifact, op))


# ---------------------------------------------------------------------------
# Persona
# ---------------------------------------------------------------------------

_register_canonical("persona", [
    "get",
    "create",
    "update",
    "delete",
    "duplicate",
    "draft",
    "search",
    "drafts",
    "docs",
    "export",
    "refresh",
])


# ---------------------------------------------------------------------------
# Lookup helpers
# ---------------------------------------------------------------------------


def get_ws_event_config(artifact: str, operation: str) -> WsEventConfig | None:
    """Look up the event config for an (artifact, operation) pair."""
    return WS_EVENTS.get((artifact, operation))


def get_output_events(artifact: str, operation: str) -> list[str]:
    """Get the list of possible output events for an input event."""
    config = WS_EVENTS.get((artifact, operation))
    return config.output_events if config else []


def get_all_input_events(artifact: str | None = None) -> list[str]:
    """Get all registered input events, optionally filtered by artifact."""
    return [
        config.input_event
        for key, config in WS_EVENTS.items()
        if artifact is None or key[0] == artifact
    ]


def get_all_output_events(artifact: str | None = None) -> list[str]:
    """Get all registered output events, optionally filtered by artifact."""
    events: list[str] = []
    for key, config in WS_EVENTS.items():
        if artifact is None or key[0] == artifact:
            events.extend(config.output_events)
    return events
