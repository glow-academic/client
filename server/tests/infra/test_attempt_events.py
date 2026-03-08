"""Tests for trivial attempt event translators — EmitFn pattern.

Each impl is a simple pass-through: receive data → resolve context → emit event.
Uses recording_emit() to capture events.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.attempt_events_impl import (
    audio_delta_impl,
    audio_error_impl,
    audio_session_start_impl,
    audio_speech_delta_impl,
    audio_speech_start_impl,
    user_progress_impl,
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
