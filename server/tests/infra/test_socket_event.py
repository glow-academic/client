"""Tests for infra.websocket.socket_event — SocketEvent + flush_events.

SocketEvent construction is pure (no mocks needed).
flush_events uses dependency injection — pass mock emitters directly.
"""

from unittest.mock import AsyncMock

import pytest

from app.infra.websocket.socket_event import (
    SocketEvent,
    client_event,
    flush_events,
    internal_event,
)


# ═══════════════════════════════════════════════════════════════════════════
# SocketEvent construction — pure unit tests
# ═══════════════════════════════════════════════════════════════════════════


class TestSocketEventConstruction:
    def test_client_event_defaults(self):
        e = client_event("generation_started", {"run_id": "abc"})
        assert e.bus == "client"
        assert e.event == "generation_started"
        assert e.data == {"run_id": "abc"}
        assert e.room is None
        assert e.sid is None

    def test_client_event_with_room(self):
        e = client_event("progress", {"pct": 50}, room="sid-123")
        assert e.room == "sid-123"

    def test_internal_event_defaults(self):
        e = internal_event("generate_artifact", {"agent_id": "x"})
        assert e.bus == "internal"
        assert e.event == "generate_artifact"
        assert e.data == {"agent_id": "x"}
        assert e.sid is None
        assert e.room is None

    def test_internal_event_with_sid(self):
        e = internal_event("generate_artifact", {"agent_id": "x"}, sid="sid-456")
        assert e.sid == "sid-456"

    def test_frozen(self):
        e = client_event("test", {})
        with pytest.raises(AttributeError):
            e.bus = "internal"  # type: ignore[misc]


# ═══════════════════════════════════════════════════════════════════════════
# flush_events — DI-based tests (no patching needed)
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestFlushEvents:
    async def test_empty_list_does_nothing(self):
        """No events → no emit calls."""
        mock_client = AsyncMock()
        mock_internal = AsyncMock()
        await flush_events([], client_sio=mock_client, internal_sio=mock_internal)
        mock_client.emit.assert_not_called()
        mock_internal.emit.assert_not_called()

    async def test_client_event_emits_to_sio(self):
        e = client_event("gen_complete", {"id": "1"}, room="room-1")
        mock_client = AsyncMock()
        mock_internal = AsyncMock()
        await flush_events([e], client_sio=mock_client, internal_sio=mock_internal)

        mock_client.emit.assert_called_once_with(
            "gen_complete", {"id": "1"}, room="room-1"
        )
        mock_internal.emit.assert_not_called()

    async def test_client_event_room_defaults_to_empty(self):
        e = client_event("test", {"x": 1})
        mock_client = AsyncMock()
        await flush_events([e], client_sio=mock_client, internal_sio=AsyncMock())

        mock_client.emit.assert_called_once_with("test", {"x": 1}, room="")

    async def test_internal_event_emits_to_internal_sio(self):
        e = internal_event("generate_artifact", {"agent": "a"}, sid="sid-1")
        mock_client = AsyncMock()
        mock_internal = AsyncMock()
        await flush_events([e], client_sio=mock_client, internal_sio=mock_internal)

        mock_internal.emit.assert_called_once_with("generate_artifact", {"agent": "a"})
        mock_client.emit.assert_not_called()

    async def test_mixed_events_emit_in_order(self):
        """Client and internal events interleaved — all emitted in order."""
        events = [
            client_event("started", {"a": 1}, room="r1"),
            internal_event("dispatch_1", {"b": 2}),
            internal_event("dispatch_2", {"c": 3}),
            client_event("done", {"d": 4}, room="r1"),
        ]

        mock_client = AsyncMock()
        mock_internal = AsyncMock()
        await flush_events(
            events, client_sio=mock_client, internal_sio=mock_internal
        )

        assert mock_client.emit.call_count == 2
        assert mock_internal.emit.call_count == 2

        # Verify order for client
        client_calls = mock_client.emit.call_args_list
        assert client_calls[0].args == ("started", {"a": 1})
        assert client_calls[1].args == ("done", {"d": 4})

        # Verify order for internal
        internal_calls = mock_internal.emit.call_args_list
        assert internal_calls[0].args == ("dispatch_1", {"b": 2})
        assert internal_calls[1].args == ("dispatch_2", {"c": 3})

    async def test_unknown_bus_raises(self):
        e = SocketEvent(bus="unknown", event="x", data={})
        with pytest.raises(ValueError, match="Unknown bus: unknown"):
            await flush_events(
                [e], client_sio=AsyncMock(), internal_sio=AsyncMock()
            )
