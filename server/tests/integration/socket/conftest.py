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


class MockInternalBus:
    """Mock InternalBus for testing internal socket events."""

    def __init__(self) -> None:
        self.emitted_events: list[tuple[str, dict[str, Any]]] = []
        self._handlers: dict[str, list[Any]] = {}

    def on(self, event: str) -> Any:
        """Decorator to register a handler for an event."""

        def decorator(fn: Any) -> Any:
            self._handlers.setdefault(event, []).append(fn)
            return fn

        return decorator

    async def emit(self, event: str, data: dict[str, Any]) -> None:
        """Capture emitted internal events."""
        self.emitted_events.append((event, data))
        # Also call registered handlers if any
        handlers = self._handlers.get(event, [])
        for handler in handlers:
            try:
                await handler(data)
            except Exception:
                pass  # Ignore errors in test handlers

    def get_events(self, event_name: str | None = None) -> list[dict[str, Any]]:
        """Get captured events, optionally filtered by event name."""
        if event_name:
            return [data for event, data in self.emitted_events if event == event_name]
        return [data for _, data in self.emitted_events]

    def clear(self) -> None:
        """Clear captured events."""
        self.emitted_events.clear()


@pytest.fixture
def mock_sio() -> MockSocketIO:
    """Provide a mock Socket.IO server instance."""
    return MockSocketIO()


@pytest.fixture
def mock_internal_sio() -> MockInternalBus:
    """Provide a mock InternalBus instance."""
    return MockInternalBus()


@pytest.fixture(autouse=True)
def patch_sio_instance(
    mock_sio: MockSocketIO,
    mock_internal_sio: MockInternalBus,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Patch sio and internal_sio to return the mock servers in all handler modules.

    Handlers import sio at module import time, so we need to patch it
    in each handler module, not just in main.
    """
    from app import main

    # Patch sio in main module
    monkeypatch.setattr(main, "sio", mock_sio)
    # Patch internal_sio in main module
    monkeypatch.setattr(main, "internal_sio", mock_internal_sio)
    monkeypatch.setattr(main, "get_internal_sio", lambda: mock_internal_sio)

    # Import and patch sio in all handler modules that import it
    # This ensures handlers use the mock instance instead of the real one
    handler_module_paths = [
        # Lifecycle
        "app.socket.v3.connect",
        "app.socket.v3.disconnect",
        "app.socket.v3.log",
        # Actions
        "app.socket.v3.actions.keycloak",
        # Evals
        "app.socket.v3.evals.enter",
        "app.socket.v3.evals.join",
        "app.socket.v3.evals.leave",
        "app.socket.v3.evals.start",
        "app.socket.v3.evals.stop",
        "app.socket.v3.evals.run_start",
        "app.socket.v3.evals.run_stop",
        "app.socket.v3.evals.runs_start_all",
        "app.socket.v3.evals.process_next",
        # Rubrics
        "app.socket.v3.rubrics.generate",
        "app.socket.v3.rubrics.tools.standard_group_descriptions",
        # Images
        "app.socket.v3.images.generate",
        "app.socket.v3.images.complete",
        # Videos
        "app.socket.v3.videos.generate",
        # Simulations
        "app.socket.v3.simulations.enter",
        "app.socket.v3.simulations.join",
        "app.socket.v3.simulations.leave",
        "app.socket.v3.simulations.text.start",
        "app.socket.v3.simulations.text.send",
        "app.socket.v3.simulations.text.stop",
        "app.socket.v3.simulations.text.end",
        "app.socket.v3.simulations.text.practice",
        "app.socket.v3.simulations.voice.start",
        "app.socket.v3.simulations.voice.stop",
        "app.socket.v3.simulations.voice.debug",
        "app.socket.v3.simulations.voice.user.start",
        "app.socket.v3.simulations.voice.user.speech",
        "app.socket.v3.simulations.voice.user.delta",
        "app.socket.v3.simulations.voice.user.text",
        "app.socket.v3.simulations.voice.user.transcript",
        "app.socket.v3.simulations.voice.assistant.audio",
        "app.socket.v3.simulations.voice.assistant.delta",
        "app.socket.v3.simulations.voice.assistant.done",
        "app.socket.v3.simulations.voice.assistant.interrupted",
        "app.socket.v3.simulations.grading.start",
        "app.socket.v3.simulations.grading.tools.feedback",
        "app.socket.v3.simulations.grading.tools.message_strength",
        "app.socket.v3.simulations.grading.tools.message_improvement",
        "app.socket.v3.simulations.grading.tools.audio",
        "app.socket.v3.simulations.hints.generate",
        "app.socket.v3.simulations.hints.create",
        "app.socket.v3.simulations.run.create",
        "app.socket.v3.simulations.message.create",
        "app.socket.v3.simulations.group.link",
        "app.socket.v3.simulations.messages.link",
        "app.socket.v3.simulations.streaming.message",
        "app.socket.v3.simulations.streaming.tool_call",
        # Scenarios
        "app.socket.v3.scenarios.generate",
        "app.socket.v3.scenarios.regenerate",
        "app.socket.v3.scenarios.tools.objectives",
        "app.socket.v3.scenarios.tools.questions",
        "app.socket.v3.scenarios.tools.statement",
        "app.socket.v3.scenarios.tools.image",
        "app.socket.v3.scenarios.tools.video",
        "app.socket.v3.scenarios.tools.document",
        "app.socket.v3.scenarios.image.link",
        # Documents
        "app.socket.v3.documents.generate",
        "app.socket.v3.documents.template.create",
    ]

    for module_path in handler_module_paths:
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "sio"):
                monkeypatch.setattr(module, "sio", mock_sio)
            if hasattr(module, "internal_sio"):
                monkeypatch.setattr(module, "internal_sio", mock_internal_sio)
            if hasattr(module, "get_internal_sio"):
                monkeypatch.setattr(
                    module, "get_internal_sio", lambda: mock_internal_sio
                )
        except ImportError:
            pass  # Module might not exist


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
        # Lifecycle
        "app.socket.v3.connect",
        "app.socket.v3.disconnect",
        "app.socket.v3.log",
        # Actions
        "app.socket.v3.actions.keycloak",
        # Evals
        "app.socket.v3.evals.enter",
        "app.socket.v3.evals.start",
        "app.socket.v3.evals.stop",
        "app.socket.v3.evals.run_start",
        "app.socket.v3.evals.run_stop",
        "app.socket.v3.evals.process_next",
        # Rubrics
        "app.socket.v3.rubrics.generate",
        # Images
        "app.socket.v3.images.generate",
        "app.socket.v3.images.complete",
        # Videos
        "app.socket.v3.videos.generate",
        # Simulations
        "app.socket.v3.simulations.enter",
        "app.socket.v3.simulations.text.start",
        "app.socket.v3.simulations.text.send",
        "app.socket.v3.simulations.text.stop",
        "app.socket.v3.simulations.text.end",
        "app.socket.v3.simulations.text.practice",
        "app.socket.v3.simulations.voice.start",
        "app.socket.v3.simulations.grading.start",
        "app.socket.v3.simulations.grading.tools.feedback",
        "app.socket.v3.simulations.grading.tools.message_strength",
        "app.socket.v3.simulations.grading.tools.message_improvement",
        "app.socket.v3.simulations.grading.tools.audio",
        "app.socket.v3.simulations.hints.generate",
        "app.socket.v3.simulations.hints.create",
        "app.socket.v3.simulations.run.create",
        "app.socket.v3.simulations.message.create",
        "app.socket.v3.simulations.group.link",
        "app.socket.v3.simulations.messages.link",
        "app.socket.v3.simulations.streaming.message",
        "app.socket.v3.simulations.streaming.tool_call",
        # Scenarios
        "app.socket.v3.scenarios.generate",
        "app.socket.v3.scenarios.regenerate",
        "app.socket.v3.scenarios.tools.objectives",
        "app.socket.v3.scenarios.tools.questions",
        "app.socket.v3.scenarios.tools.statement",
        "app.socket.v3.scenarios.tools.image",
        "app.socket.v3.scenarios.tools.video",
        "app.socket.v3.scenarios.tools.document",
        "app.socket.v3.scenarios.image.link",
        # Documents
        "app.socket.v3.documents.generate",
        "app.socket.v3.documents.template.create",
        # Utils
        "app.utils.websocket.cleanup_profile_connection",
    ]

    for module_path in import_modules:
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "get_pool"):
                monkeypatch.setattr(module, "get_pool", mock_get_pool)
        except ImportError:
            pass  # Module might not exist or might not import get_pool
