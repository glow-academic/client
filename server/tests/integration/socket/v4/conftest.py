"""Pytest configuration for WebSocket v4 integration tests."""

import importlib
from typing import Any

import asyncpg  # type: ignore
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
            if not self.rooms[room]:
                del self.rooms[room]

    async def disconnect(self, sid: str) -> None:
        """Disconnect a socket (mock implementation)."""
        for room in list(self.rooms.keys()):
            self.rooms[room].discard(sid)
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
def patch_sio_instance(
    mock_sio: MockSocketIO,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Patch sio in main and handler modules used by lifecycle tests."""
    from app import main  # type: ignore

    monkeypatch.setattr(main, "sio", mock_sio)

    handler_module_paths = [
        "app.socket.v4.connect",
        "app.socket.v4.disconnect",
    ]

    for module_path in handler_module_paths:
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "sio"):
                monkeypatch.setattr(module, "sio", mock_sio)
        except ImportError:
            pass


@pytest.fixture(autouse=True)
def patch_get_db_connection(
    db: asyncpg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Patch get_db_connection to return the test database connection."""
    from collections.abc import AsyncGenerator
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def mock_get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
        yield db

    from app.infra.v4.websocket import get_db_connection  # type: ignore

    monkeypatch.setattr(get_db_connection, "get_db_connection", mock_get_db_connection)

    import_modules = [
        "app.socket.v4.connect",
        "app.socket.v4.disconnect",
    ]

    for module_path in import_modules:
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "get_db_connection"):
                monkeypatch.setattr(module, "get_db_connection", mock_get_db_connection)
        except ImportError:
            pass
