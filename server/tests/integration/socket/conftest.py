"""Pytest configuration for WebSocket integration tests."""

import importlib
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

    async def leave_room(self, sid: str, room: str) -> None:
        """Remove sid from a room."""
        if room in self.rooms:
            self.rooms[room].discard(sid)
            # Clean up empty rooms
            if not self.rooms[room]:
                del self.rooms[room]

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
    """Patch sio to return the mock server in all handler modules.
    
    Handlers import sio at module import time, so we need to patch it
    in each handler module, not just in main.
    """
    from app import main

    # Patch sio in main module
    monkeypatch.setattr(main, "sio", mock_sio)
    
    # Import and patch sio in all handler modules that import it
    # This ensures handlers use the mock instance instead of the real one
    handler_module_paths = [
        "app.socket.assistants.send_message",
        "app.socket.assistants.start",
        "app.socket.assistants.stop",
        "app.socket.simulations.send_message",
        "app.socket.simulations.start",
        "app.socket.simulations.stop",
        "app.socket.simulations.continue_chat",
        "app.socket.connections.connect",
        "app.socket.connections.disconnect",
        "app.socket.connections.join_chat",
        "app.socket.connections.leave_chat",
        "app.socket.connections.stop_chat",
    ]
    
    for module_path in handler_module_paths:
        module = importlib.import_module(module_path)
        monkeypatch.setattr(module, "sio", mock_sio)
