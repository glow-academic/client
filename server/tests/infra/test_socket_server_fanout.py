"""Focused tests for socket server fanout bridges."""

from __future__ import annotations

import pytest

from app.routes.v5.socket.server.attempt.started import (
    attempt_started_server_handler,
)
from app.routes.v5.socket.server.test.grade_start import (
    test_grade_start_server_handler as handle_test_grade_start,
)


pytestmark = pytest.mark.asyncio


async def test_attempt_started_server_handler_uses_rooms_without_sid(monkeypatch) -> None:
    emitted: list[tuple[str, dict, str | None]] = []

    async def _emit(event: str, payload: dict, room: str | None = None) -> None:
        emitted.append((event, payload, room))

    monkeypatch.setattr(
        "app.routes.v5.socket.server.attempt.started.sio.emit",
        _emit,
    )

    await attempt_started_server_handler(
        {
            "attempt_id": "attempt-1",
            "chat_entry_id": "chat-entry-1",
            "rooms": ["attempt_room_1"],
        }
    )

    assert emitted == [
        (
            "attempt_started",
            {"attempt_id": "attempt-1", "chat_entry_id": "chat-entry-1"},
            "attempt_room_1",
        )
    ]


async def test_test_grade_start_server_handler_accepts_test_invocation_id(
    monkeypatch,
) -> None:
    emitted: list[tuple[str, dict, str | None]] = []

    async def _emit(event: str, payload: dict, room: str | None = None) -> None:
        emitted.append((event, payload, room))

    monkeypatch.setattr(
        "app.routes.v5.socket.server.test.grade_start.sio.emit",
        _emit,
    )

    await handle_test_grade_start(
        {
            "test_invocation_id": "inv-1",
            "grade_id": "grade-1",
            "rooms": ["test_room_1"],
            "message": "grading",
        }
    )

    assert emitted == [
        (
            "test_progress_update",
            {
                "invocation_id": "inv-1",
                "type": "progress",
                "run_id": None,
                "current_run": None,
                "total_runs": None,
                "message": "grading",
            },
            "test_room_1",
        )
    ]
