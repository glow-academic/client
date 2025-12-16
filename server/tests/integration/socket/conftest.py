"""Pytest configuration for WebSocket integration tests."""

import importlib
from typing import TYPE_CHECKING, Any

import asyncpg  # type: ignore
import pytest

if TYPE_CHECKING:
    pass


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

    async def disconnect(self, sid: str) -> None:
        """Disconnect a socket (mock implementation)."""
        # Remove sid from all rooms
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
        "app.socket.v3.assistants.send_message",
        "app.socket.v3.assistants.start",
        "app.socket.v3.assistants.stop",
        "app.socket.v3.simulations.send_message",
        "app.socket.v3.simulations.start",
        "app.socket.v3.simulations.stop",
        "app.socket.v3.simulations.continue_chat",
        "app.socket.v3.connections.connect",
        "app.socket.v3.connections.disconnect",
        "app.socket.v3.connections.join_chat",
        "app.socket.v3.connections.leave_chat",
        "app.socket.v3.connections.stop_chat",
    ]

    for module_path in handler_module_paths:
        module = importlib.import_module(module_path)
        monkeypatch.setattr(module, "sio", mock_sio)


@pytest.fixture(autouse=True)
def patch_get_pool(db: asyncpg.Connection, monkeypatch: pytest.MonkeyPatch) -> None:
    """Patch get_pool to return a pool that uses the test database connection.

    This ensures handlers use the test database connection instead of the
    global pool, avoiding event loop issues.
    """
    from app import main

    # Create a mock pool that returns the test connection
    class ConnectionContext:
        """Async context manager that yields the test connection."""

        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        async def __aenter__(self) -> asyncpg.Connection:
            return self.conn

        async def __aexit__(self, *args: Any) -> None:
            pass

    class MockPool:
        def __init__(self, conn: asyncpg.Connection) -> None:
            self.conn = conn

        def acquire(self) -> ConnectionContext:
            # Return a context manager that yields the test connection
            return ConnectionContext(self.conn)

    # Patch get_pool to return a mock pool with the test connection
    def mock_get_pool() -> MockPool | None:
        return MockPool(db)

    monkeypatch.setattr(main, "get_pool", mock_get_pool)

    # Also patch in modules that import get_pool directly
    import_modules = [
        "app.socket.v3.assistants.start",
        "app.socket.v3.assistants.send_message",
        "app.socket.v3.assistants.stop",
        "app.socket.v3.connections.connect",
        "app.socket.v3.connections.disconnect",
        "app.socket.v3.simulations.start",
        "app.socket.v3.simulations.send_message",
        "app.socket.v3.simulations.stop",
        "app.socket.v3.simulations.continue_chat",
        "app.utils.websocket.cleanup_profile_connection",
    ]

    for module_path in import_modules:
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "get_pool"):
                monkeypatch.setattr(module, "get_pool", mock_get_pool)
        except ImportError:
            pass  # Module might not exist or might not import get_pool
