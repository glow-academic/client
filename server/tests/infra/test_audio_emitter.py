"""Tests for InternalBusAudioEmitter — EmitFn pattern.

Each method emits one or more internal events via recording_emit().
Session context is tested via patched get_session_by_group_id.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.infra.websocket.socket_event import recording_emit
from app.routes.v5.socket.internal.attempt.audio.events import (
    InternalBusAudioEmitter,
)

_SESSION_STORE = "app.routes.v5.socket.internal.attempt.audio.events.get_session_by_group_id"


def _make_session(
    sid: str = "s1",
    artifact_type: str = "chat",
    resource_type: str = "personas",
    run_id: str = "run1",
    metadata: dict | None = None,
    tool_output_schemas: dict | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(
        sid=sid,
        artifact_type=artifact_type,
        resource_type=resource_type,
        run_id=run_id,
        group_id="g1",
        metadata=metadata or {},
        tool_call_states={},
        tool_output_schemas=tool_output_schemas or {},
    )


# ═══════════════════════════════════════════════════════════════════════════
# Session context
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestSessionContext:
    @patch(_SESSION_STORE, return_value=None)
    async def test_no_session_returns_defaults(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        ctx = emitter._session_context("g1")
        assert ctx["sid"] == ""
        assert ctx["modality"] == "audio"
        assert ctx["group_id"] == "g1"

    @patch(_SESSION_STORE)
    async def test_with_session_returns_context(self, mock_store):
        mock_store.return_value = _make_session(
            sid="s1", artifact_type="chat", run_id="r1"
        )
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        ctx = emitter._session_context("g1")
        assert ctx["sid"] == "s1"
        assert ctx["artifact_type"] == "chat"
        assert ctx["run_id"] == "r1"


# ═══════════════════════════════════════════════════════════════════════════
# Assistant audio events
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAssistantAudio:
    @patch(_SESSION_STORE, return_value=None)
    async def test_on_audio_start(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_audio_start("g1")

        assert len(events) == 1
        assert events[0].event == "generate_audio_start"
        assert events[0].data["type"] == "start"
        assert events[0].data["event_type"] == "audio_start"

    async def test_on_audio_delta(self):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_audio_delta("g1", b"\x00\x01")

        assert len(events) == 1
        assert events[0].event == "generate_audio_progress"
        assert events[0].data["audio"] == b"\x00\x01"

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_audio_complete(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_audio_complete("g1")

        assert len(events) == 1
        assert events[0].event == "generate_audio_complete"
        assert events[0].data["event_type"] == "audio_complete"


# ═══════════════════════════════════════════════════════════════════════════
# Assistant transcript events
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAssistantTranscript:
    @patch(_SESSION_STORE, return_value=None)
    async def test_on_transcript_start(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_transcript_start("g1", "item1")

        assert len(events) == 1
        assert events[0].event == "generate_text_start"
        assert events[0].data["event_type"] == "text_start"

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_transcript_delta(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_transcript_delta("g1", "hello ")

        assert len(events) == 1
        assert events[0].event == "generate_text_progress"
        assert events[0].data["delta"] == "hello "

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_transcript_complete(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_transcript_complete("g1", "item1", "hello world")

        assert len(events) == 1
        assert events[0].event == "generate_text_complete"
        assert events[0].data["text"] == "hello world"


# ═══════════════════════════════════════════════════════════════════════════
# Tool call events
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestToolCalls:
    @patch(_SESSION_STORE)
    async def test_on_tool_call_start_sets_state(self, mock_store):
        session = _make_session()
        mock_store.return_value = session

        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_tool_call_start("g1", "item1", "call1", "my_tool")

        assert len(events) == 1
        assert events[0].event == "generate_call_start"
        assert events[0].data["tool_call_id"] == "call1"
        assert session.tool_call_states["call1"]["tool_name"] == "my_tool"

    @patch(_SESSION_STORE)
    async def test_on_tool_call_delta_accumulates(self, mock_store):
        session = _make_session()
        session.tool_call_states["call1"] = {
            "call_id": "call1",
            "tool_name": "my_tool",
            "arguments": '{"na',
        }
        mock_store.return_value = session

        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_tool_call_delta("g1", "call1", 'me": "test"}')

        assert len(events) == 1
        assert events[0].event == "generate_call_progress"
        assert events[0].data["arguments_delta"] == 'me": "test"}'
        # Accumulated arguments should be parseable
        assert session.tool_call_states["call1"]["arguments"] == '{"name": "test"}'

    @patch(_SESSION_STORE)
    async def test_on_tool_call_complete_clears_state(self, mock_store):
        session = _make_session()
        session.tool_call_states["call1"] = {
            "call_id": "call1",
            "tool_name": "my_tool",
            "arguments": '{"name": "test"}',
        }
        mock_store.return_value = session

        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_tool_call_complete("g1", "call1", "my_tool", '{"name": "test"}')

        assert len(events) == 1
        assert events[0].event == "generate_call_complete"
        assert events[0].data["tool_name"] == "my_tool"
        assert events[0].data["arguments"] == {"name": "test"}
        assert "call1" not in session.tool_call_states

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_tool_call_complete_no_session(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_tool_call_complete("g1", "call1", "my_tool", '{"x": 1}')

        assert len(events) == 1
        assert events[0].data["arguments"] == {"x": 1}
        assert events[0].data["resolved_fields"] is None

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_tool_call_complete_invalid_json(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_tool_call_complete("g1", "call1", "my_tool", "not json")

        assert len(events) == 1
        assert events[0].data["arguments"] == {}


# ═══════════════════════════════════════════════════════════════════════════
# User speech events
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestUserSpeech:
    async def test_on_user_speech_start(self):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_user_speech_start("g1", "item1")

        assert len(events) == 1
        assert events[0].event == "generate_audio_user_speech_start"
        assert events[0].data["item_id"] == "item1"

    async def test_on_user_speech_delta(self):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_user_speech_delta("g1", "item1", "hello")

        assert len(events) == 1
        assert events[0].event == "generate_audio_user_speech_delta"
        assert events[0].data["transcript"] == "hello"

    async def test_on_user_speech_complete_without_audio(self):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_user_speech_complete("g1", "item1", "hello world")

        assert len(events) == 1
        assert events[0].event == "generate_audio_user_speech_complete"
        assert events[0].data["transcript"] == "hello world"
        assert "audio" not in events[0].data

    async def test_on_user_speech_complete_with_audio(self):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_user_speech_complete(
            "g1", "item1", "hello world", audio=b"\x00\x01"
        )

        assert len(events) == 1
        assert events[0].data["audio"] == b"\x00\x01"


# ═══════════════════════════════════════════════════════════════════════════
# Lifecycle events
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestLifecycle:
    async def test_on_error(self):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_error("g1", "something broke")

        assert len(events) == 1
        assert events[0].event == "generate_audio_error"
        assert events[0].data["error_message"] == "something broke"

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_response_cancelled(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_response_cancelled(
            "g1", usage={"input_tokens": 10, "output_tokens": 20}
        )

        assert len(events) == 1
        assert events[0].event == "generate_audio_response_cancelled"
        assert events[0].data["input_text_tokens"] == 10
        assert events[0].data["output_text_tokens"] == 20

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_response_done_emits_two_events(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_response_done(
            "g1", usage={"input_tokens": 5, "output_tokens": 15}
        )

        assert len(events) == 2
        assert events[0].event == "generate_run_complete"
        assert events[0].data["input_text_tokens"] == 5
        assert events[0].data["save"] is False
        assert events[1].event == "generate_audio_response_done"
        assert events[1].data["usage"] == {"input_tokens": 5, "output_tokens": 15}

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_response_done_default_usage(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_response_done("g1")

        assert len(events) == 2
        assert events[0].data["input_text_tokens"] == 0
        assert events[0].data["output_text_tokens"] == 0

    @patch(_SESSION_STORE, return_value=None)
    async def test_on_response_cancelled_default_usage(self, _mock):
        emit, events = recording_emit()
        emitter = InternalBusAudioEmitter(emit=emit)
        await emitter.on_response_cancelled("g1")

        assert len(events) == 1
        assert events[0].data["input_text_tokens"] == 0
