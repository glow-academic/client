"""Pytest configuration for WebSocket v4 integration tests."""

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
    from app import main  # type: ignore

    # Patch sio in main module
    monkeypatch.setattr(main, "sio", mock_sio)
    # Patch internal_sio in main module
    monkeypatch.setattr(main, "internal_sio", mock_internal_sio)
    monkeypatch.setattr(main, "get_internal_sio", lambda: mock_internal_sio)

    # Import and patch sio in all handler modules that import it
    # This ensures handlers use the mock instance instead of the real one
    handler_module_paths = [
        # Lifecycle
        "app.socket.v4.connect",
        "app.socket.v4.disconnect",
        "app.socket.v4.log",
        # Simulations
        "app.socket.v4.simulations.start",
        "app.socket.v4.simulations.join",
        "app.socket.v4.simulations.enter",
        "app.socket.v4.simulations.leave",
        "app.socket.v4.simulations.advance",
        "app.socket.v4.simulations.next",
        "app.socket.v4.simulations.stop",
        "app.socket.v4.simulations.end",
        # Benchmark
        "app.socket.v4.benchmark.start",
        "app.socket.v4.benchmark.join",
        "app.socket.v4.benchmark.enter",
        "app.socket.v4.benchmark.leave",
        "app.socket.v4.benchmark.advance",
        "app.socket.v4.benchmark.next",
        "app.socket.v4.benchmark.stop",
        "app.socket.v4.benchmark.end",
        "app.socket.v4.benchmark.error",
        "app.socket.v4.benchmark.eval_complete",
        # Agents - Audio
        "app.socket.v4.agents.audio.generate",
        "app.socket.v4.agents.audio.regenerate",
        "app.socket.v4.agents.audio.progress",
        "app.socket.v4.agents.audio.complete",
        "app.socket.v4.agents.audio.error",
        "app.socket.v4.agents.audio.eval",
        "app.socket.v4.agents.audio.tools.debug.call",
        "app.socket.v4.agents.audio.tools.debug.complete",
        "app.socket.v4.agents.audio.tools.debug.error",
        "app.socket.v4.agents.audio.tools.debug.eval",
        "app.socket.v4.agents.audio.tools.debug.progress",
        # Agents - Classify
        "app.socket.v4.agents.classify.generate",
        "app.socket.v4.agents.classify.regenerate",
        "app.socket.v4.agents.classify.progress",
        "app.socket.v4.agents.classify.complete",
        "app.socket.v4.agents.classify.error",
        "app.socket.v4.agents.classify.eval",
        "app.socket.v4.agents.classify.tools.debug.call",
        "app.socket.v4.agents.classify.tools.debug.complete",
        "app.socket.v4.agents.classify.tools.debug.error",
        "app.socket.v4.agents.classify.tools.debug.eval",
        "app.socket.v4.agents.classify.tools.debug.progress",
        "app.socket.v4.agents.classify.tools.classification.call",
        "app.socket.v4.agents.classify.tools.classification.complete",
        "app.socket.v4.agents.classify.tools.classification.error",
        "app.socket.v4.agents.classify.tools.classification.eval",
        "app.socket.v4.agents.classify.tools.classification.progress",
        # Agents - Document
        "app.socket.v4.agents.document.generate",
        "app.socket.v4.agents.document.regenerate",
        "app.socket.v4.agents.document.progress",
        "app.socket.v4.agents.document.complete",
        "app.socket.v4.agents.document.error",
        "app.socket.v4.agents.document.eval",
        "app.socket.v4.agents.document.tools.debug.call",
        "app.socket.v4.agents.document.tools.debug.complete",
        "app.socket.v4.agents.document.tools.debug.error",
        "app.socket.v4.agents.document.tools.debug.eval",
        "app.socket.v4.agents.document.tools.debug.progress",
        "app.socket.v4.agents.document.tools.title.call",
        "app.socket.v4.agents.document.tools.title.complete",
        "app.socket.v4.agents.document.tools.title.error",
        "app.socket.v4.agents.document.tools.title.eval",
        "app.socket.v4.agents.document.tools.title.progress",
        # Agents - Grade
        "app.socket.v4.agents.grade.generate",
        "app.socket.v4.agents.grade.regenerate",
        "app.socket.v4.agents.grade.progress",
        "app.socket.v4.agents.grade.complete",
        "app.socket.v4.agents.grade.error",
        "app.socket.v4.agents.grade.eval",
        "app.socket.v4.agents.grade.tools.debug.call",
        "app.socket.v4.agents.grade.tools.debug.complete",
        "app.socket.v4.agents.grade.tools.debug.error",
        "app.socket.v4.agents.grade.tools.debug.eval",
        "app.socket.v4.agents.grade.tools.debug.progress",
        "app.socket.v4.agents.grade.tools.audio.call",
        "app.socket.v4.agents.grade.tools.audio.complete",
        "app.socket.v4.agents.grade.tools.audio.error",
        "app.socket.v4.agents.grade.tools.audio.eval",
        "app.socket.v4.agents.grade.tools.audio.progress",
        "app.socket.v4.agents.grade.tools.grade.call",
        "app.socket.v4.agents.grade.tools.grade.complete",
        "app.socket.v4.agents.grade.tools.grade.error",
        "app.socket.v4.agents.grade.tools.grade.eval",
        "app.socket.v4.agents.grade.tools.grade.progress",
        "app.socket.v4.agents.grade.tools.improvement.call",
        "app.socket.v4.agents.grade.tools.improvement.complete",
        "app.socket.v4.agents.grade.tools.improvement.error",
        "app.socket.v4.agents.grade.tools.improvement.eval",
        "app.socket.v4.agents.grade.tools.improvement.progress",
        "app.socket.v4.agents.grade.tools.strength.call",
        "app.socket.v4.agents.grade.tools.strength.complete",
        "app.socket.v4.agents.grade.tools.strength.error",
        "app.socket.v4.agents.grade.tools.strength.eval",
        "app.socket.v4.agents.grade.tools.strength.progress",
        # Agents - Hint
        "app.socket.v4.agents.hint.generate",
        "app.socket.v4.agents.hint.regenerate",
        "app.socket.v4.agents.hint.progress",
        "app.socket.v4.agents.hint.complete",
        "app.socket.v4.agents.hint.error",
        "app.socket.v4.agents.hint.eval",
        "app.socket.v4.agents.hint.tools.debug.call",
        "app.socket.v4.agents.hint.tools.debug.complete",
        "app.socket.v4.agents.hint.tools.debug.error",
        "app.socket.v4.agents.hint.tools.debug.eval",
        "app.socket.v4.agents.hint.tools.debug.progress",
        "app.socket.v4.agents.hint.tools.hint.call",
        "app.socket.v4.agents.hint.tools.hint.complete",
        "app.socket.v4.agents.hint.tools.hint.error",
        "app.socket.v4.agents.hint.tools.hint.eval",
        "app.socket.v4.agents.hint.tools.hint.progress",
        # Agents - Image
        "app.socket.v4.agents.image.generate",
        "app.socket.v4.agents.image.regenerate",
        "app.socket.v4.agents.image.progress",
        "app.socket.v4.agents.image.complete",
        "app.socket.v4.agents.image.error",
        "app.socket.v4.agents.image.eval",
        "app.socket.v4.agents.image.tools.debug.call",
        "app.socket.v4.agents.image.tools.debug.complete",
        "app.socket.v4.agents.image.tools.debug.error",
        "app.socket.v4.agents.image.tools.debug.eval",
        "app.socket.v4.agents.image.tools.debug.progress",
        "app.socket.v4.agents.image.tools.title.call",
        "app.socket.v4.agents.image.tools.title.complete",
        "app.socket.v4.agents.image.tools.title.error",
        "app.socket.v4.agents.image.tools.title.eval",
        "app.socket.v4.agents.image.tools.title.progress",
        # Agents - Member
        "app.socket.v4.agents.member.generate",
        "app.socket.v4.agents.member.regenerate",
        "app.socket.v4.agents.member.progress",
        "app.socket.v4.agents.member.complete",
        "app.socket.v4.agents.member.error",
        "app.socket.v4.agents.member.eval",
        "app.socket.v4.agents.member.tools.conversation.call",
        "app.socket.v4.agents.member.tools.conversation.complete",
        "app.socket.v4.agents.member.tools.conversation.error",
        "app.socket.v4.agents.member.tools.conversation.eval",
        "app.socket.v4.agents.member.tools.conversation.progress",
        # Agents - Rubric
        "app.socket.v4.agents.rubric.generate",
        "app.socket.v4.agents.rubric.regenerate",
        "app.socket.v4.agents.rubric.progress",
        "app.socket.v4.agents.rubric.complete",
        "app.socket.v4.agents.rubric.error",
        "app.socket.v4.agents.rubric.eval",
        "app.socket.v4.agents.rubric.tools.debug.call",
        "app.socket.v4.agents.rubric.tools.debug.complete",
        "app.socket.v4.agents.rubric.tools.debug.error",
        "app.socket.v4.agents.rubric.tools.debug.eval",
        "app.socket.v4.agents.rubric.tools.debug.progress",
        "app.socket.v4.agents.rubric.tools.rubric.call",
        "app.socket.v4.agents.rubric.tools.rubric.complete",
        "app.socket.v4.agents.rubric.tools.rubric.error",
        "app.socket.v4.agents.rubric.tools.rubric.eval",
        "app.socket.v4.agents.rubric.tools.rubric.progress",
        "app.socket.v4.agents.rubric.tools.title.call",
        "app.socket.v4.agents.rubric.tools.title.complete",
        "app.socket.v4.agents.rubric.tools.title.error",
        "app.socket.v4.agents.rubric.tools.title.eval",
        "app.socket.v4.agents.rubric.tools.title.progress",
        # Agents - Scenario
        "app.socket.v4.agents.scenario.generate",
        "app.socket.v4.agents.scenario.regenerate",
        "app.socket.v4.agents.scenario.progress",
        "app.socket.v4.agents.scenario.complete",
        "app.socket.v4.agents.scenario.error",
        "app.socket.v4.agents.scenario.eval",
        "app.socket.v4.agents.scenario.tools.debug.call",
        "app.socket.v4.agents.scenario.tools.debug.complete",
        "app.socket.v4.agents.scenario.tools.debug.error",
        "app.socket.v4.agents.scenario.tools.debug.eval",
        "app.socket.v4.agents.scenario.tools.debug.progress",
        "app.socket.v4.agents.scenario.tools.document.call",
        "app.socket.v4.agents.scenario.tools.document.complete",
        "app.socket.v4.agents.scenario.tools.document.error",
        "app.socket.v4.agents.scenario.tools.document.eval",
        "app.socket.v4.agents.scenario.tools.document.progress",
        "app.socket.v4.agents.scenario.tools.image.call",
        "app.socket.v4.agents.scenario.tools.image.complete",
        "app.socket.v4.agents.scenario.tools.image.error",
        "app.socket.v4.agents.scenario.tools.image.eval",
        "app.socket.v4.agents.scenario.tools.image.progress",
        "app.socket.v4.agents.scenario.tools.objective.call",
        "app.socket.v4.agents.scenario.tools.objective.complete",
        "app.socket.v4.agents.scenario.tools.objective.error",
        "app.socket.v4.agents.scenario.tools.objective.eval",
        "app.socket.v4.agents.scenario.tools.objective.progress",
        "app.socket.v4.agents.scenario.tools.question.call",
        "app.socket.v4.agents.scenario.tools.question.complete",
        "app.socket.v4.agents.scenario.tools.question.error",
        "app.socket.v4.agents.scenario.tools.question.eval",
        "app.socket.v4.agents.scenario.tools.question.progress",
        "app.socket.v4.agents.scenario.tools.statement.call",
        "app.socket.v4.agents.scenario.tools.statement.complete",
        "app.socket.v4.agents.scenario.tools.statement.error",
        "app.socket.v4.agents.scenario.tools.statement.eval",
        "app.socket.v4.agents.scenario.tools.statement.progress",
        "app.socket.v4.agents.scenario.tools.title.call",
        "app.socket.v4.agents.scenario.tools.title.complete",
        "app.socket.v4.agents.scenario.tools.title.error",
        "app.socket.v4.agents.scenario.tools.title.eval",
        "app.socket.v4.agents.scenario.tools.title.progress",
        "app.socket.v4.agents.scenario.tools.video.call",
        "app.socket.v4.agents.scenario.tools.video.complete",
        "app.socket.v4.agents.scenario.tools.video.error",
        "app.socket.v4.agents.scenario.tools.video.eval",
        "app.socket.v4.agents.scenario.tools.video.progress",
        # Agents - Simulation
        "app.socket.v4.agents.simulation.generate",
        "app.socket.v4.agents.simulation.regenerate",
        "app.socket.v4.agents.simulation.progress",
        "app.socket.v4.agents.simulation.complete",
        "app.socket.v4.agents.simulation.error",
        "app.socket.v4.agents.simulation.eval",
        "app.socket.v4.agents.simulation.tools.debug.call",
        "app.socket.v4.agents.simulation.tools.debug.complete",
        "app.socket.v4.agents.simulation.tools.debug.error",
        "app.socket.v4.agents.simulation.tools.debug.eval",
        "app.socket.v4.agents.simulation.tools.debug.progress",
        "app.socket.v4.agents.simulation.tools.speak.call",
        "app.socket.v4.agents.simulation.tools.speak.complete",
        "app.socket.v4.agents.simulation.tools.speak.error",
        "app.socket.v4.agents.simulation.tools.speak.eval",
        "app.socket.v4.agents.simulation.tools.speak.progress",
        # Agents - Video
        "app.socket.v4.agents.video.generate",
        "app.socket.v4.agents.video.regenerate",
        "app.socket.v4.agents.video.progress",
        "app.socket.v4.agents.video.complete",
        "app.socket.v4.agents.video.error",
        "app.socket.v4.agents.video.eval",
        "app.socket.v4.agents.video.tools.debug.call",
        "app.socket.v4.agents.video.tools.debug.complete",
        "app.socket.v4.agents.video.tools.debug.error",
        "app.socket.v4.agents.video.tools.debug.eval",
        "app.socket.v4.agents.video.tools.debug.progress",
        "app.socket.v4.agents.video.tools.title.call",
        "app.socket.v4.agents.video.tools.title.complete",
        "app.socket.v4.agents.video.tools.title.error",
        "app.socket.v4.agents.video.tools.title.eval",
        "app.socket.v4.agents.video.tools.title.progress",
        # Agents - Voice
        "app.socket.v4.agents.voice.generate",
        "app.socket.v4.agents.voice.regenerate",
        "app.socket.v4.agents.voice.progress",
        "app.socket.v4.agents.voice.complete",
        "app.socket.v4.agents.voice.error",
        "app.socket.v4.agents.voice.eval",
        "app.socket.v4.agents.voice.tools.debug.call",
        "app.socket.v4.agents.voice.tools.debug.complete",
        "app.socket.v4.agents.voice.tools.debug.error",
        "app.socket.v4.agents.voice.tools.debug.eval",
        "app.socket.v4.agents.voice.tools.debug.progress",
        "app.socket.v4.agents.voice.tools.speak.call",
        "app.socket.v4.agents.voice.tools.speak.complete",
        "app.socket.v4.agents.voice.tools.speak.error",
        "app.socket.v4.agents.voice.tools.speak.eval",
        "app.socket.v4.agents.voice.tools.speak.progress",
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
def patch_get_db_connection(
    db: asyncpg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Patch get_db_connection to return the test database connection.

    v4 handlers use get_db_connection() instead of get_pool().
    This ensures handlers use the test database connection instead of the
    global pool, avoiding event loop issues.
    """
    from collections.abc import AsyncGenerator
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def mock_get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
        """Mock get_db_connection that yields the test connection."""
        yield db

    # Patch get_db_connection in the infra module
    from app.infra.v4.websocket import get_db_connection  # type: ignore

    monkeypatch.setattr(
        get_db_connection, "get_db_connection", mock_get_db_connection
    )

    # Also patch in modules that import get_db_connection directly
    import_modules = [
        # Lifecycle
        "app.socket.v4.connect",
        "app.socket.v4.disconnect",
        "app.socket.v4.log",
        # Simulations
        "app.socket.v4.simulations.start",
        "app.socket.v4.simulations.join",
        "app.socket.v4.simulations.enter",
        "app.socket.v4.simulations.leave",
        "app.socket.v4.simulations.advance",
        "app.socket.v4.simulations.next",
        "app.socket.v4.simulations.stop",
        "app.socket.v4.simulations.end",
        # Benchmark
        "app.socket.v4.benchmark.start",
        "app.socket.v4.benchmark.join",
        "app.socket.v4.benchmark.enter",
        "app.socket.v4.benchmark.leave",
        "app.socket.v4.benchmark.advance",
        "app.socket.v4.benchmark.next",
        "app.socket.v4.benchmark.stop",
        "app.socket.v4.benchmark.end",
        "app.socket.v4.benchmark.error",
        "app.socket.v4.benchmark.eval_complete",
        # All agent modules (same list as patch_sio_instance)
        "app.socket.v4.agents.audio.generate",
        "app.socket.v4.agents.audio.regenerate",
        "app.socket.v4.agents.audio.progress",
        "app.socket.v4.agents.audio.complete",
        "app.socket.v4.agents.audio.error",
        "app.socket.v4.agents.audio.eval",
        "app.socket.v4.agents.classify.generate",
        "app.socket.v4.agents.classify.regenerate",
        "app.socket.v4.agents.classify.progress",
        "app.socket.v4.agents.classify.complete",
        "app.socket.v4.agents.classify.error",
        "app.socket.v4.agents.classify.eval",
        "app.socket.v4.agents.document.generate",
        "app.socket.v4.agents.document.regenerate",
        "app.socket.v4.agents.document.progress",
        "app.socket.v4.agents.document.complete",
        "app.socket.v4.agents.document.error",
        "app.socket.v4.agents.document.eval",
        "app.socket.v4.agents.grade.generate",
        "app.socket.v4.agents.grade.regenerate",
        "app.socket.v4.agents.grade.progress",
        "app.socket.v4.agents.grade.complete",
        "app.socket.v4.agents.grade.error",
        "app.socket.v4.agents.grade.eval",
        "app.socket.v4.agents.hint.generate",
        "app.socket.v4.agents.hint.regenerate",
        "app.socket.v4.agents.hint.progress",
        "app.socket.v4.agents.hint.complete",
        "app.socket.v4.agents.hint.error",
        "app.socket.v4.agents.hint.eval",
        "app.socket.v4.agents.image.generate",
        "app.socket.v4.agents.image.regenerate",
        "app.socket.v4.agents.image.progress",
        "app.socket.v4.agents.image.complete",
        "app.socket.v4.agents.image.error",
        "app.socket.v4.agents.image.eval",
        "app.socket.v4.agents.member.generate",
        "app.socket.v4.agents.member.regenerate",
        "app.socket.v4.agents.member.progress",
        "app.socket.v4.agents.member.complete",
        "app.socket.v4.agents.member.error",
        "app.socket.v4.agents.member.eval",
        "app.socket.v4.agents.rubric.generate",
        "app.socket.v4.agents.rubric.regenerate",
        "app.socket.v4.agents.rubric.progress",
        "app.socket.v4.agents.rubric.complete",
        "app.socket.v4.agents.rubric.error",
        "app.socket.v4.agents.rubric.eval",
        "app.socket.v4.agents.scenario.generate",
        "app.socket.v4.agents.scenario.regenerate",
        "app.socket.v4.agents.scenario.progress",
        "app.socket.v4.agents.scenario.complete",
        "app.socket.v4.agents.scenario.error",
        "app.socket.v4.agents.scenario.eval",
        "app.socket.v4.agents.simulation.generate",
        "app.socket.v4.agents.simulation.regenerate",
        "app.socket.v4.agents.simulation.progress",
        "app.socket.v4.agents.simulation.complete",
        "app.socket.v4.agents.simulation.error",
        "app.socket.v4.agents.simulation.eval",
        "app.socket.v4.agents.video.generate",
        "app.socket.v4.agents.video.regenerate",
        "app.socket.v4.agents.video.progress",
        "app.socket.v4.agents.video.complete",
        "app.socket.v4.agents.video.error",
        "app.socket.v4.agents.video.eval",
        "app.socket.v4.agents.voice.generate",
        "app.socket.v4.agents.voice.regenerate",
        "app.socket.v4.agents.voice.progress",
        "app.socket.v4.agents.voice.complete",
        "app.socket.v4.agents.voice.error",
        "app.socket.v4.agents.voice.eval",
    ]

    for module_path in import_modules:
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "get_db_connection"):
                monkeypatch.setattr(module, "get_db_connection", mock_get_db_connection)
        except ImportError:
            pass  # Module might not exist or might not import get_db_connection

