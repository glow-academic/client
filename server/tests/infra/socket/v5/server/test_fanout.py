"""Focused tests for socket server fanout bridges."""

from __future__ import annotations

from uuid import UUID

import pytest

from app.infra.stream.hub import subscribe, unsubscribe
from app.socket.v5.server.attempt.started import (
    attempt_started_server_handler,
)
from app.socket.v5.server.attempt.chat_started import (
    attempt_chat_started_server_handler,
)
from app.socket.v5.server.attempt.grade_complete import (
    attempt_grade_complete_server_handler,
)
from app.socket.v5.server.test.grade_start import (
    test_grade_start_server_handler as handle_test_grade_start,
)

pytestmark = pytest.mark.asyncio


async def test_attempt_started_server_handler_uses_rooms_without_sid(
    monkeypatch,
) -> None:
    emitted: list[tuple[str, dict, str | None]] = []

    async def _emit(event: str, payload: dict, room: str | None = None) -> None:
        emitted.append((event, payload, room))

    monkeypatch.setattr(
        "app.socket.v5.server.attempt.started.sio.emit",
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
        "app.socket.v5.server.test.grade_start.sio.emit",
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


async def test_attempt_chat_started_server_handler_publishes_live_event_without_rooms(
    monkeypatch,
) -> None:
    emitted: list[tuple[str, dict, str | None]] = []

    async def _emit(event: str, payload: dict, room: str | None = None) -> None:
        emitted.append((event, payload, room))

    monkeypatch.setattr(
        "app.socket.v5.server.attempt.chat_started.sio.emit",
        _emit,
    )

    queue = subscribe(artifact="attempt", operation="start")
    try:
        await attempt_chat_started_server_handler(
            {
                "attempt_id": "11111111-1111-1111-1111-111111111111",
                "chat_id": "22222222-2222-2222-2222-222222222222",
            }
        )

        event = await queue.get()
        assert event.event_type == "artifacts.attempt.chat_started"
        assert str(event.entity_id) == "11111111-1111-1111-1111-111111111111"
        assert event.payload["chat_id"] == "22222222-2222-2222-2222-222222222222"
        assert emitted == []
    finally:
        unsubscribe(queue)


async def test_attempt_grade_complete_server_handler_publishes_live_event_without_rooms(
    monkeypatch,
) -> None:
    emitted: list[tuple[str, dict, str | None]] = []

    async def _emit(event: str, payload: dict, room: str | None = None) -> None:
        emitted.append((event, payload, room))

    monkeypatch.setattr(
        "app.socket.v5.server.attempt.grade_complete.sio.emit",
        _emit,
    )

    queue = subscribe(
        artifact="attempt",
        operation="grade",
        entity_id=UUID("33333333-3333-3333-3333-333333333333"),
    )
    try:
        await attempt_grade_complete_server_handler(
            {
                "attempt_id": "33333333-3333-3333-3333-333333333333",
                "chat_id": "44444444-4444-4444-4444-444444444444",
                "grade_id": "55555555-5555-5555-5555-555555555555",
            }
        )

        event = await queue.get()
        assert event.event_type == "artifacts.attempt.grade.complete"
        assert str(event.entity_id) == "33333333-3333-3333-3333-333333333333"
        assert event.payload["grade_id"] == "55555555-5555-5555-5555-555555555555"
        assert emitted == []
    finally:
        unsubscribe(queue)
