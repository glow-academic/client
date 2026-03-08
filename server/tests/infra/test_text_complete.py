"""Tests for text_complete_impl — EmitFn pattern.

Saves assistant message to DB via persist_run_message.
Uses recording_emit() to capture events.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch
from uuid import UUID

import pytest

from app.infra.websocket.socket_event import recording_emit
from app.infra.websocket.text_complete_impl import text_complete_impl

_P = "app.infra.websocket.text_complete_impl"

_RUN_ID = "00000000-0000-0000-0000-000000000001"
_SESSION_ID = "00000000-0000-0000-0000-000000000002"


@pytest.mark.asyncio
class TestTextCompleteImpl:
    async def test_non_text_complete_skipped(self):
        emit, events = recording_emit()
        await text_complete_impl({"event_type": "other"}, emit=emit, conn=AsyncMock())
        assert events == []

    async def test_no_run_id_skipped(self):
        emit, events = recording_emit()
        await text_complete_impl(
            {"event_type": "text_complete", "session_id": _SESSION_ID, "text": "hello"},
            emit=emit,
            conn=AsyncMock(),
        )
        assert events == []

    async def test_no_session_id_skipped(self):
        emit, events = recording_emit()
        await text_complete_impl(
            {"event_type": "text_complete", "run_id": _RUN_ID, "text": "hello"},
            emit=emit,
            conn=AsyncMock(),
        )
        assert events == []

    async def test_empty_text_skipped(self):
        emit, events = recording_emit()
        await text_complete_impl(
            {
                "event_type": "text_complete",
                "run_id": _RUN_ID,
                "session_id": _SESSION_ID,
                "text": "",
            },
            emit=emit,
            conn=AsyncMock(),
        )
        assert events == []

    async def test_saves_assistant_message(self):
        emit, events = recording_emit()
        mock_conn = AsyncMock()
        with patch(f"{_P}.persist_run_message", new_callable=AsyncMock) as mock_persist:
            await text_complete_impl(
                {
                    "event_type": "text_complete",
                    "run_id": _RUN_ID,
                    "session_id": _SESSION_ID,
                    "text": "Hello world",
                },
                emit=emit,
                conn=mock_conn,
            )

        mock_persist.assert_called_once_with(
            mock_conn,
            run_id=UUID(_RUN_ID),
            session_id=UUID(_SESSION_ID),
            role="assistant",
            content="Hello world",
        )

    async def test_persist_error_does_not_raise(self):
        emit, events = recording_emit()
        with patch(
            f"{_P}.persist_run_message",
            new_callable=AsyncMock,
            side_effect=RuntimeError("db down"),
        ):
            # Should not raise
            await text_complete_impl(
                {
                    "event_type": "text_complete",
                    "run_id": _RUN_ID,
                    "session_id": _SESSION_ID,
                    "text": "Hello world",
                },
                emit=emit,
                conn=AsyncMock(),
            )
        assert events == []
