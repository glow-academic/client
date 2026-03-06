"""SocketEvent — pure data container for deferred WebSocket emission.

Pure functions build SocketEvent lists instead of emitting directly.
The thin I/O handler calls flush_events() to send them.

Two buses:
  - "client"   → sio.emit (client-facing namespace)
  - "internal" → internal_sio.emit (server-to-server namespace)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class AsyncEmitter(Protocol):
    """Minimal interface for a socket emitter (sio or internal_sio)."""

    async def emit(self, event: str, data: Any, **kwargs: Any) -> None: ...


@dataclass(frozen=True)
class SocketEvent:
    """A deferred WebSocket event ready for emission."""

    bus: str  # "client" | "internal"
    event: str  # event name, e.g. "generation_started"
    data: dict[str, Any]  # serialized payload (already model_dump'd)
    sid: str | None = None  # routing: socket ID
    room: str | None = None  # routing: room name (client bus only)


def client_event(
    event: str,
    data: dict[str, Any],
    *,
    room: str | None = None,
) -> SocketEvent:
    """Build a client-bus event."""
    return SocketEvent(bus="client", event=event, data=data, room=room)


def internal_event(
    event: str,
    data: dict[str, Any],
    *,
    sid: str | None = None,
) -> SocketEvent:
    """Build an internal-bus event."""
    return SocketEvent(bus="internal", event=event, data=data, sid=sid)


async def flush_events(
    events: list[SocketEvent],
    *,
    client_sio: AsyncEmitter | None = None,
    internal_sio: AsyncEmitter | None = None,
) -> None:
    """Emit a list of SocketEvents to their respective buses.

    This is the single I/O boundary — everything before this is pure.

    When called without explicit emitters, resolves them from globals
    (production path). Pass explicit emitters for testing.
    """
    if client_sio is None or internal_sio is None:
        from app.infra.globals import get_internal_sio, sio

        if client_sio is None:
            client_sio = sio
        if internal_sio is None:
            internal_sio = get_internal_sio()

    for e in events:
        if e.bus == "client":
            await client_sio.emit(e.event, e.data, room=e.room or "")
        elif e.bus == "internal":
            await internal_sio.emit(e.event, e.data)
        else:
            raise ValueError(f"Unknown bus: {e.bus}")
