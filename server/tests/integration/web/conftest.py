"""Pytest configuration for WebSocket integration tests."""

from typing import Any

import pytest


class MockSocketIO:
    """Mock Socket.IO server for testing."""

    def __init__(self) -> None:
        self.emitted_events: list[tuple[str, dict[str, Any], str | None]] = []
        self.rooms: dict[str, set[str]] = {}  # room -> set of sids

    async def emit(
        self, event: str, data: dict[str, Any], room: str | None = None
    ) -> None:
        """Capture emitted events."""
        self.emitted_events.append((event, data, room))

    async def enter_room(self, sid: str, room: str) -> None:
        """Add sid to a room."""
        if room not in self.rooms:
            self.rooms[room] = set()
        self.rooms[room].add(sid)

    def get_events(self, event_name: str | None = None) -> list[dict[str, Any]]:
        """Get captured events, optionally filtered by event name."""
        if event_name:
            return [
                data for event, data, _ in self.emitted_events if event == event_name
            ]
        return [data for _, data, _ in self.emitted_events]

    def clear(self) -> None:
        """Clear captured events."""
        self.emitted_events.clear()
        self.rooms.clear()


@pytest.fixture
def mock_sio() -> MockSocketIO:
    """Provide a mock Socket.IO server instance."""
    return MockSocketIO()


@pytest.fixture(autouse=True)
def patch_sio_instance(mock_sio: MockSocketIO, monkeypatch: pytest.MonkeyPatch) -> None:
    """Patch get_sio_instance to return the mock server."""
    from app.web.assistants import utils as assistants_utils
    from app.web.simulations import utils as simulations_utils

    def mock_get_sio_instance() -> Any:
        return mock_sio

    monkeypatch.setattr(assistants_utils, "get_sio_instance", mock_get_sio_instance)
    monkeypatch.setattr(simulations_utils, "get_sio_instance", mock_get_sio_instance)

