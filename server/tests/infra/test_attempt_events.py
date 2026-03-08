"""Tests for trivial attempt event translators — EmitFn pattern.

Each impl is a simple pass-through: receive data → resolve context → emit event.
Uses recording_emit() to capture events.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.test_events_impl import test_error_impl as _test_error_impl
from app.infra.websocket.attempt_events_impl import (
    attempt_next_impl,
    audio_delta_impl,
    audio_error_impl,
    audio_response_cancelled_impl,
    audio_session_start_impl,
    audio_speech_delta_impl,
    audio_speech_start_impl,
    audio_stop_impl,
    user_progress_impl,
    user_start_impl,
)
from app.infra.websocket.socket_event import recording_emit

_P = "app.infra.websocket.attempt_events_impl"


# ═══════════════════════════════════════════════════════════════════════════
# user_progress_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestUserProgressImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await user_progress_impl({"sid": "", "chat_id": "c1"}, emit=emit)
        assert events == []

    async def test_no_chat_id_emits_nothing(self):
        emit, events = recording_emit()
        await user_progress_impl({"sid": "s1", "chat_id": ""}, emit=emit)
        assert events == []

    async def test_emits_user_progress(self):
        emit, events = recording_emit()
        await user_progress_impl(
            {"sid": "s1", "chat_id": "c1", "transcript": "hello", "item_id": "i1"},
            emit=emit,
        )
        assert len(events) == 1
        assert events[0].event == "attempt_user_progress"
        assert events[0].data["transcript"] == "hello"
        assert events[0].data["chat_id"] == "c1"


# ═══════════════════════════════════════════════════════════════════════════
# audio_session_start_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAudioSessionStartImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await audio_session_start_impl({"group_id": "g1"}, emit=emit)
        assert events == []

    async def test_no_group_id_emits_nothing(self):
        emit, events = recording_emit()
        await audio_session_start_impl({"sid": "s1"}, emit=emit)
        assert events == []

    async def test_emits_audio_ready_with_session(self):
        emit, events = recording_emit()
        session = SimpleNamespace(chat_id="chat-1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_session_start_impl(
                {"sid": "s1", "group_id": "g1"}, emit=emit
            )
        assert len(events) == 1
        assert events[0].event == "attempt_audio_ready"
        assert events[0].data["chat_id"] == "chat-1"

    async def test_no_session_uses_group_id_as_chat_id(self):
        emit, events = recording_emit()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await audio_session_start_impl(
                {"sid": "s1", "group_id": "g1"}, emit=emit
            )
        assert events[0].data["chat_id"] == "g1"


# ═══════════════════════════════════════════════════════════════════════════
# audio_delta_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAudioDeltaImpl:
    async def test_no_group_id_emits_nothing(self):
        emit, events = recording_emit()
        await audio_delta_impl({}, emit=emit)
        assert events == []

    async def test_no_session_emits_nothing(self):
        emit, events = recording_emit()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await audio_delta_impl({"group_id": "g1", "audio": b"data"}, emit=emit)
        assert events == []

    async def test_no_audio_data_emits_nothing(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_delta_impl({"group_id": "g1"}, emit=emit)
        assert events == []

    async def test_emits_assistant_progress(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_delta_impl(
                {"group_id": "g1", "audio": b"chunk"}, emit=emit
            )
        assert len(events) == 1
        assert events[0].event == "attempt_assistant_progress"
        assert events[0].data["content_type"] == "audio"


# ═══════════════════════════════════════════════════════════════════════════
# audio_speech_start_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAudioSpeechStartImpl:
    async def test_no_group_id_emits_nothing(self):
        emit, events = recording_emit()
        await audio_speech_start_impl({}, emit=emit)
        assert events == []

    async def test_no_session_emits_nothing(self):
        emit, events = recording_emit()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await audio_speech_start_impl(
                {"group_id": "g1", "item_id": "i1"}, emit=emit
            )
        assert events == []

    async def test_no_item_id_emits_nothing(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1", run_id="r1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_speech_start_impl({"group_id": "g1"}, emit=emit)
        assert events == []

    async def test_emits_user_received_start(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1", run_id="r1")
        with (
            patch(f"{_P}.get_session_by_group_id", return_value=session),
            patch(f"{_P}.find_profile_by_socket", return_value="prof-1"),
        ):
            await audio_speech_start_impl(
                {"group_id": "g1", "item_id": "i1"}, emit=emit
            )
        assert len(events) == 1
        assert events[0].event == "attempt_user_received_start"
        assert events[0].data["profile_id"] == "prof-1"
        assert events[0].data["item_id"] == "i1"


# ═══════════════════════════════════════════════════════════════════════════
# audio_speech_delta_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAudioSpeechDeltaImpl:
    async def test_no_group_id_emits_nothing(self):
        emit, events = recording_emit()
        await audio_speech_delta_impl({}, emit=emit)
        assert events == []

    async def test_no_session_emits_nothing(self):
        emit, events = recording_emit()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await audio_speech_delta_impl(
                {"group_id": "g1", "item_id": "i1"}, emit=emit
            )
        assert events == []

    async def test_no_item_id_emits_nothing(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_speech_delta_impl({"group_id": "g1"}, emit=emit)
        assert events == []

    async def test_emits_user_received_progress(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_speech_delta_impl(
                {"group_id": "g1", "item_id": "i1", "transcript": "hi"},
                emit=emit,
            )
        assert len(events) == 1
        assert events[0].event == "attempt_user_received_progress"
        assert events[0].data["transcript"] == "hi"


# ═══════════════════════════════════════════════════════════════════════════
# audio_error_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAudioErrorImpl:
    async def test_no_group_id_emits_nothing(self):
        emit, events = recording_emit()
        await audio_error_impl({}, emit=emit)
        assert events == []

    async def test_no_session_emits_nothing(self):
        emit, events = recording_emit()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await audio_error_impl({"group_id": "g1"}, emit=emit)
        assert events == []

    async def test_emits_attempt_error(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_error_impl(
                {"group_id": "g1", "error_message": "mic broke"}, emit=emit
            )
        assert len(events) == 1
        assert events[0].event == "attempt_error"
        assert events[0].data["error_type"] == "audio"
        assert events[0].data["message"] == "mic broke"

    async def test_default_error_message(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_error_impl({"group_id": "g1"}, emit=emit)
        assert events[0].data["message"] == "Unknown audio error"


# ═══════════════════════════════════════════════════════════════════════════
# attempt_next_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAttemptNextImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await attempt_next_impl(
            {"sid": ""},
            emit=emit,
            attempt_id="a1",
            group_id="g1",
            draft_id=None,
        )
        assert events == []

    async def test_emits_attempt_proceed(self):
        emit, events = recording_emit()
        await attempt_next_impl(
            {"sid": "s1"},
            emit=emit,
            attempt_id="a1",
            group_id="g1",
            draft_id="d1",
        )
        assert len(events) == 1
        assert events[0].event == "attempt_proceed"
        assert events[0].data["force_proceed"] is True
        assert events[0].data["attempt_id"] == "a1"
        assert events[0].data["draft_id"] == "d1"

    async def test_error_emits_attempt_error(self):
        """If emit raises during proceed, emits attempt_error instead."""
        call_count = 0

        async def failing_emit(events_list):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("bus down")
            # Second call (error emit) succeeds — capture it
            captured.extend(events_list)

        captured = []
        await attempt_next_impl(
            {"sid": "s1"},
            emit=failing_emit,
            attempt_id="a1",
            group_id="g1",
            draft_id=None,
        )
        assert len(captured) == 1
        assert captured[0].event == "attempt_error"
        assert "bus down" in captured[0].data["message"]


# ═══════════════════════════════════════════════════════════════════════════
# user_start_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestUserStartImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await user_start_impl(
            {"sid": "", "chat_id": "c1", "run_id": "r1"},
            emit=emit,
            conn=AsyncMock(),
        )
        assert events == []

    async def test_no_chat_id_emits_nothing(self):
        emit, events = recording_emit()
        await user_start_impl(
            {"sid": "s1", "chat_id": "", "run_id": "r1"},
            emit=emit,
            conn=AsyncMock(),
        )
        assert events == []

    async def test_no_run_id_emits_nothing(self):
        emit, events = recording_emit()
        await user_start_impl(
            {"sid": "s1", "chat_id": "c1", "run_id": ""},
            emit=emit,
            conn=AsyncMock(),
        )
        assert events == []

    async def test_creates_message_and_emits_user_start(self):
        emit, events = recording_emit()
        mock_conn = AsyncMock()
        mock_result = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000099",
            created_at=SimpleNamespace(isoformat=lambda: "2025-01-01T00:00:00"),
        )
        with patch(
            "app.routes.v5.tools.entries.messages.create.create_message",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            await user_start_impl(
                {
                    "sid": "s1",
                    "chat_id": "00000000-0000-0000-0000-000000000001",
                    "run_id": "00000000-0000-0000-0000-000000000002",
                },
                emit=emit,
                conn=mock_conn,
            )
        assert len(events) == 1
        assert events[0].event == "attempt_user_start"
        assert events[0].data["message_id"] == "00000000-0000-0000-0000-000000000099"
        mock_conn.execute.assert_called_once()


# ═══════════════════════════════════════════════════════════════════════════
# audio_stop_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAudioStopImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await audio_stop_impl({"group_id": "g1"}, emit=emit)
        assert events == []

    async def test_no_session_emits_audio_ended(self):
        """Even without a session, emits audio_ended."""
        emit, events = recording_emit()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await audio_stop_impl(
                {"sid": "s1", "group_id": "g1"}, emit=emit
            )
        assert len(events) == 1
        assert events[0].event == "attempt_audio_ended"
        assert events[0].data["chat_id"] == "g1"

    async def test_with_session_cleans_up_and_emits(self):
        emit, events = recording_emit()
        session = SimpleNamespace(chat_id="c1")
        with (
            patch(f"{_P}.get_session_by_group_id", return_value=session),
            patch(
                "app.infra.websocket.audio_lifecycle.cleanup_audio_session",
                new_callable=AsyncMock,
            ) as mock_cleanup,
        ):
            await audio_stop_impl(
                {"sid": "s1", "group_id": "g1"}, emit=emit
            )
        mock_cleanup.assert_called_once_with(session)
        assert events[0].data["chat_id"] == "c1"


# ═══════════════════════════════════════════════════════════════════════════
# audio_response_cancelled_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAudioResponseCancelledImpl:
    async def test_no_group_id_emits_nothing(self):
        emit, events = recording_emit()
        await audio_response_cancelled_impl({}, emit=emit)
        assert events == []

    async def test_no_session_emits_nothing(self):
        emit, events = recording_emit()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await audio_response_cancelled_impl(
                {"group_id": "g1"}, emit=emit
            )
        assert events == []

    async def test_emits_stopped_and_generate(self):
        emit, events = recording_emit()
        session = SimpleNamespace(sid="s1", chat_id="c1")
        with patch(f"{_P}.get_session_by_group_id", return_value=session):
            await audio_response_cancelled_impl(
                {"group_id": "g1", "artifact_type": "agent"}, emit=emit
            )
        assert len(events) == 2
        assert events[0].event == "attempt_stopped"
        assert events[0].data["chat_id"] == "c1"
        assert events[1].event == "generate"
        assert events[1].data["group_id"] == "g1"


# ═══════════════════════════════════════════════════════════════════════════
# test_error_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestTestErrorImpl:
    async def test_emits_test_error(self):
        emit, events = recording_emit()
        await _test_error_impl(
            {
                "sid": "s1",
                "invocation_id": "inv-1",
                "error_message": "bad input",
                "run_id": "r1",
                "error_type": "validation",
            },
            emit=emit,
        )
        assert len(events) == 1
        assert events[0].event == "test_error"
        assert events[0].data["message"] == "bad input"
        assert events[0].data["invocation_id"] == "inv-1"
        assert events[0].data["error_type"] == "validation"
        assert "test_inv-1" in events[0].data["rooms"]

    async def test_no_sid_still_emits(self):
        emit, events = recording_emit()
        await _test_error_impl(
            {"invocation_id": "inv-1", "message": "oops"}, emit=emit
        )
        assert len(events) == 1
        assert events[0].data["rooms"] == []

    async def test_fallback_to_chat_id(self):
        emit, events = recording_emit()
        await _test_error_impl(
            {"sid": "s1", "chat_id": "chat-1"}, emit=emit
        )
        assert events[0].data["invocation_id"] == "chat-1"

    async def test_default_message(self):
        emit, events = recording_emit()
        await _test_error_impl({"sid": "s1"}, emit=emit)
        assert events[0].data["message"] == "Test error"
