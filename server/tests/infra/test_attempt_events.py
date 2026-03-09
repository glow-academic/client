"""Tests for trivial attempt event translators — EmitFn pattern.

Each impl is a simple pass-through: receive data → resolve context → emit event.
Uses recording_emit() to capture events.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest

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
from app.infra.websocket.attempt_events_impl import (
    attempt_proceed_impl as _attempt_proceed_impl,
)
from app.infra.websocket.attempt_events_impl import (
    attempt_start_impl as _attempt_start_impl,
)
from app.infra.websocket.attempt_events_impl import (
    emit_chat_generate_impl as _emit_chat_generate_impl,
)
from app.infra.websocket.attempt_events_impl import (
    speech_complete_impl as _speech_complete_impl,
)
from app.infra.websocket.attempt_events_impl import (
    user_complete_impl as _user_complete_impl,
)
from app.infra.websocket.socket_event import recording_emit
from app.infra.websocket.test_events_impl import (
    _extract_grade_feedback,
    _extract_grade_passed,
    _extract_grade_score,
    _find_next_run_id,
)
from app.infra.websocket.test_events_impl import (
    test_error_impl as _test_error_impl,
)
from app.infra.websocket.test_events_impl import (
    test_grade_complete_impl as _test_grade_complete_impl,
)
from app.infra.websocket.test_events_impl import (
    test_group_impl as _test_group_impl,
)
from app.infra.websocket.test_events_impl import (
    test_next_impl as _test_next_impl,
)
from app.infra.websocket.test_events_impl import (
    test_proceed_impl as _test_proceed_impl,
)
from app.infra.websocket.test_events_impl import (
    test_progress_impl as _test_progress_impl,
)
from app.infra.websocket.test_events_impl import (
    test_run_done_impl as _test_run_done_impl,
)
from app.infra.websocket.test_events_impl import (
    test_run_impl as _test_run_impl,
)
from app.infra.websocket.test_events_impl import (
    test_start_impl as _test_start_impl,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.groups.create import create_group
from app.routes.v5.tools.entries.runs.create import create_run
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test.create import create_test
from app.routes.v5.tools.entries.test.refresh import refresh_test
from app.routes.v5.tools.entries.test_grade.create import create_test_grade
from app.routes.v5.tools.entries.test_invocation.create import create_test_invocation
from app.routes.v5.tools.entries.test_invocation.refresh import refresh_test_invocation
from app.routes.v5.tools.resources.profiles.create import create_profile

_P = "app.infra.websocket.attempt_events_impl"


def _mock_pool(mock_conn: AsyncMock | None = None) -> MagicMock:
    """Create a mock pool whose acquire() yields mock_conn."""
    if mock_conn is None:
        mock_conn = AsyncMock()
    pool = MagicMock()
    cm = AsyncMock()
    cm.__aenter__.return_value = mock_conn
    pool.acquire.return_value = cm
    return pool


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
            await audio_session_start_impl({"sid": "s1", "group_id": "g1"}, emit=emit)
        assert len(events) == 1
        assert events[0].event == "attempt_audio_ready"
        assert events[0].data["chat_id"] == "chat-1"

    async def test_no_session_uses_group_id_as_chat_id(self):
        emit, events = recording_emit()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await audio_session_start_impl({"sid": "s1", "group_id": "g1"}, emit=emit)
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
            await audio_delta_impl({"group_id": "g1", "audio": b"chunk"}, emit=emit)
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
            pool=_mock_pool(),
        )
        assert events == []

    async def test_no_chat_id_emits_nothing(self):
        emit, events = recording_emit()
        await user_start_impl(
            {"sid": "s1", "chat_id": "", "run_id": "r1"},
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    async def test_no_run_id_emits_nothing(self):
        emit, events = recording_emit()
        await user_start_impl(
            {"sid": "s1", "chat_id": "c1", "run_id": ""},
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    async def test_creates_message_and_emits_user_start(self):
        emit, events = recording_emit()
        mock_conn = AsyncMock()
        mock_result = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000099",
            created_at=SimpleNamespace(isoformat=lambda: "2025-01-01T00:00:00"),
        )
        mock_attempt_msg = SimpleNamespace(
            id="00000000-0000-0000-0000-000000000088",
        )
        mock_call = SimpleNamespace(id=UUID(int=77))
        with (
            patch(
                "app.routes.v5.tools.entries.messages.create.create_message",
                new_callable=AsyncMock,
                return_value=mock_result,
            ),
            patch(
                "app.routes.v5.tools.entries.attempt_message.create.create_attempt_message",
                new_callable=AsyncMock,
                return_value=mock_attempt_msg,
            ),
            patch(
                "app.routes.v5.tools.entries.calls.create.create_call",
                new_callable=AsyncMock,
                return_value=mock_call,
            ),
        ):
            await user_start_impl(
                {
                    "sid": "s1",
                    "chat_id": "00000000-0000-0000-0000-000000000001",
                    "run_id": "00000000-0000-0000-0000-000000000002",
                },
                emit=emit,
                pool=_mock_pool(mock_conn),
            )
        assert len(events) == 1
        assert events[0].event == "attempt_user_start"
        assert events[0].data["message_id"] == "00000000-0000-0000-0000-000000000099"


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
            await audio_stop_impl({"sid": "s1", "group_id": "g1"}, emit=emit)
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
            await audio_stop_impl({"sid": "s1", "group_id": "g1"}, emit=emit)
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
            await audio_response_cancelled_impl({"group_id": "g1"}, emit=emit)
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
        await _test_error_impl({"invocation_id": "inv-1", "message": "oops"}, emit=emit)
        assert len(events) == 1
        assert events[0].data["rooms"] == []

    async def test_fallback_to_chat_id(self):
        emit, events = recording_emit()
        await _test_error_impl({"sid": "s1", "chat_id": "chat-1"}, emit=emit)
        assert events[0].data["invocation_id"] == "chat-1"

    async def test_default_message(self):
        emit, events = recording_emit()
        await _test_error_impl({"sid": "s1"}, emit=emit)
        assert events[0].data["message"] == "Test error"


# ═══════════════════════════════════════════════════════════════════════════
# test_progress_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestProgressImpl:
    async def test_no_invocation_id_emits_nothing(self):
        emit, events = recording_emit()
        await _test_progress_impl({"sid": "s1"}, emit=emit)
        assert events == []

    async def test_emits_test_grade_start(self):
        emit, events = recording_emit()
        await _test_progress_impl(
            {
                "sid": "s1",
                "invocation_id": "inv-1",
                "run_id": "r1",
                "current_run": 2,
                "total_runs": 5,
                "message": "Grading...",
            },
            emit=emit,
        )
        assert len(events) == 1
        assert events[0].event == "test_grade_start"
        assert events[0].data["invocation_id"] == "inv-1"
        assert events[0].data["current_run"] == 2
        assert events[0].data["total_runs"] == 5
        assert events[0].data["message"] == "Grading..."
        assert events[0].data["rooms"] == ["s1", "test_inv-1"]

    async def test_fallback_to_chat_id(self):
        emit, events = recording_emit()
        await _test_progress_impl({"sid": "s1", "chat_id": "chat-1"}, emit=emit)
        assert events[0].data["invocation_id"] == "chat-1"

    async def test_no_sid_empty_rooms(self):
        emit, events = recording_emit()
        await _test_progress_impl({"invocation_id": "inv-1"}, emit=emit)
        assert events[0].data["rooms"] == []


# ═══════════════════════════════════════════════════════════════════════════
# test_run_done_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestRunDoneImpl:
    async def test_no_invocation_id_emits_nothing(self):
        emit, events = recording_emit()
        await _test_run_done_impl({"sid": "s1"}, emit=emit)
        assert events == []

    async def test_emits_test_run_complete(self):
        emit, events = recording_emit()
        await _test_run_done_impl(
            {
                "sid": "s1",
                "invocation_id": "inv-1",
                "run_id": "r1",
                "original_run_resource_id": "orig-1",
                "tool_calls": [{"name": "tool1"}],
                "current_run": 2,
                "total_runs": 5,
            },
            emit=emit,
        )
        assert len(events) == 1
        assert events[0].event == "test_run_complete"
        assert events[0].data["invocation_id"] == "inv-1"
        assert events[0].data["run_id"] == "r1"
        assert events[0].data["original_run_resource_id"] == "orig-1"
        assert events[0].data["tool_calls"] == [{"name": "tool1"}]
        assert events[0].data["current_run"] == 2
        assert events[0].data["total_runs"] == 5
        assert events[0].data["remaining_runs"] == 3
        assert events[0].data["rooms"] == ["s1", "test_inv-1"]

    async def test_defaults_current_and_total(self):
        emit, events = recording_emit()
        await _test_run_done_impl({"sid": "s1", "invocation_id": "inv-1"}, emit=emit)
        assert events[0].data["current_run"] == 1
        assert events[0].data["total_runs"] == 1
        assert events[0].data["remaining_runs"] == 0

    async def test_no_run_id_is_none(self):
        emit, events = recording_emit()
        await _test_run_done_impl({"sid": "s1", "invocation_id": "inv-1"}, emit=emit)
        assert events[0].data["run_id"] is None
        assert events[0].data["original_run_resource_id"] is None


# ═══════════════════════════════════════════════════════════════════════════
# test_next_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestNextImpl:
    async def _setup_test(self, conn, redis_client):
        profile = await create_profile(conn, redis_client, name="test-next-profile")
        session = await create_session(conn, profile_id=profile.id)
        group = await create_group(conn, session_id=session.id)
        run = await create_run(conn, group_id=group.id, session_id=session.id)
        test_call = await create_call(conn, run_id=run.id, session_id=session.id)
        test = await create_test(conn, call_id=test_call.id, profiles_id=profile.id)
        return test, run, session, group

    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await _test_next_impl({"test_id": "123"}, emit=emit, pool=_mock_pool())
        assert events == []

    async def test_invalid_test_id_emits_error(self):
        emit, events = recording_emit()
        await _test_next_impl({"sid": "s1"}, emit=emit, pool=_mock_pool())
        assert len(events) == 1
        assert events[0].bus == "client"
        assert events[0].event == "test_error"
        assert events[0].room == "s1"

    async def test_no_invocations_emits_all_complete(self, pool, redis_client):
        async with pool.acquire() as conn:
            test, _run, _session, _group = await self._setup_test(conn, redis_client)
            await refresh_test(conn)
            await refresh_test_invocation(conn)
        emit, events = recording_emit()
        await _test_next_impl(
            {"sid": "s1", "test_id": str(test.id)},
            emit=emit,
            pool=pool,
        )
        assert len(events) == 1
        assert events[0].bus == "client"
        assert events[0].event == "test_all_complete"
        assert events[0].data["success"] is True
        assert events[0].room == "s1"

    async def test_pending_invocation_emits_test_run(self, pool, redis_client):
        async with pool.acquire() as conn:
            test, run, session, group = await self._setup_test(conn, redis_client)
            invocation_call = await create_call(
                conn, run_id=run.id, session_id=session.id
            )
            invocation = await create_test_invocation(
                conn,
                test_id=test.id,
                call_id=invocation_call.id,
                group_id=group.id,
            )
            await refresh_test(conn)
            await refresh_test_invocation(conn)
        emit, events = recording_emit()
        await _test_next_impl(
            {"sid": "s1", "test_id": str(test.id)},
            emit=emit,
            pool=pool,
        )
        assert len(events) == 1
        assert events[0].bus == "internal"
        assert events[0].event == "test_run"
        assert events[0].data["sid"] == "s1"
        assert events[0].data["invocation_id"] == str(invocation.id)

    async def test_all_completed_emits_all_complete(self, pool, redis_client):
        async with pool.acquire() as conn:
            test, run, session, group = await self._setup_test(conn, redis_client)
            first_call = await create_call(conn, run_id=run.id, session_id=session.id)
            first_invocation = await create_test_invocation(
                conn,
                test_id=test.id,
                call_id=first_call.id,
                group_id=group.id,
            )
            second_call = await create_call(conn, run_id=run.id, session_id=session.id)
            second_invocation = await create_test_invocation(
                conn,
                test_id=test.id,
                call_id=second_call.id,
            )
            complete_first_call = await create_call(
                conn, run_id=run.id, session_id=session.id
            )
            await create_test_grade(
                conn,
                invocation_id=first_invocation.id,
                call_id=complete_first_call.id,
                run_id=run.id,
                time_taken=10,
                passed=True,
                score=90,
            )
            complete_second_call = await create_call(
                conn, run_id=run.id, session_id=session.id
            )
            await create_test_grade(
                conn,
                invocation_id=second_invocation.id,
                call_id=complete_second_call.id,
                run_id=run.id,
                time_taken=10,
                passed=True,
                score=85,
            )
            await refresh_test(conn)
            await refresh_test_invocation(conn)
        emit, events = recording_emit()
        await _test_next_impl(
            {"sid": "s1", "test_id": str(test.id)},
            emit=emit,
            pool=pool,
        )
        assert len(events) == 1
        assert events[0].bus == "client"
        assert events[0].event == "test_all_complete"
        assert events[0].data["invocation_id"] in {
            str(first_invocation.id),
            str(second_invocation.id),
        }
        assert events[0].data["total_runs"] == 2
        assert events[0].data["success"] is True


# ═══════════════════════════════════════════════════════════════════════════
# Grade extraction helpers
# ═══════════════════════════════════════════════════════════════════════════


class TestExtractGradeHelpers:
    def test_extract_score(self):
        assert _extract_grade_score([{"result": {"score": 85}}]) == 85

    def test_extract_score_from_total(self):
        assert _extract_grade_score([{"result": {"total": 90}}]) == 90

    def test_extract_score_none(self):
        assert _extract_grade_score([{"result": {"other": 1}}]) is None

    def test_extract_score_empty(self):
        assert _extract_grade_score([]) is None

    def test_extract_passed(self):
        assert _extract_grade_passed([{"result": {"passed": True}}]) is True

    def test_extract_passed_false(self):
        assert _extract_grade_passed([{"result": {"passed": False}}]) is False

    def test_extract_passed_none(self):
        assert _extract_grade_passed([{"result": {}}]) is None

    def test_extract_feedback(self):
        assert _extract_grade_feedback([{"result": {"feedback": "good"}}]) == "good"

    def test_extract_feedback_empty_string(self):
        assert _extract_grade_feedback([{"result": {"feedback": ""}}]) is None

    def test_extract_feedback_none(self):
        assert _extract_grade_feedback([{"result": {}}]) is None


# ═══════════════════════════════════════════════════════════════════════════
# test_grade_complete_impl
# ═══════════════════════════════════════════════════════════════════════════

_TOKEN_CREATE = "app.routes.v5.tools.entries.tokens.create"


@pytest.mark.asyncio
class TestGradeCompleteImpl:
    async def test_emits_test_grade_progress(self):
        emit, events = recording_emit()
        await _test_grade_complete_impl(
            {
                "sid": "s1",
                "grade_id": "g1",
                "invocation_id": "inv-1",
                "tool_results": [
                    {"result": {"score": 85, "passed": True, "feedback": "good"}}
                ],
            },
            emit=emit,
            pool=_mock_pool(),
            profile_id="prof-1",
        )
        assert len(events) == 1
        assert events[0].event == "test_grade_progress"
        assert events[0].data["score"] == 85
        assert events[0].data["passed"] is True
        assert events[0].data["feedback"] == "good"
        assert events[0].data["grade_id"] == "g1"
        assert events[0].data["invocation_id"] == "inv-1"

    @patch(f"{_TOKEN_CREATE}.create_token", new_callable=AsyncMock)
    async def test_creates_token_when_run_and_session(self, mock_create):
        mock_create.return_value = SimpleNamespace(id="tok-1")
        emit, events = recording_emit()
        await _test_grade_complete_impl(
            {
                "sid": "s1",
                "grade_id": "g1",
                "invocation_id": "inv-1",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "session_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "input_tokens": 100,
                "output_tokens": 50,
                "tool_results": [],
            },
            emit=emit,
            pool=_mock_pool(),
            profile_id="prof-1",
        )
        mock_create.assert_called_once()
        assert len(events) == 1

    async def test_skips_token_without_session(self):
        emit, events = recording_emit()
        await _test_grade_complete_impl(
            {
                "sid": "s1",
                "grade_id": "g1",
                "invocation_id": "inv-1",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "tool_results": [],
            },
            emit=emit,
            pool=_mock_pool(),
            profile_id="prof-1",
        )
        # Should still emit grade progress, just no token created
        assert len(events) == 1
        assert events[0].event == "test_grade_progress"

    async def test_rooms_include_test_prefix(self):
        emit, events = recording_emit()
        await _test_grade_complete_impl(
            {
                "sid": "s1",
                "invocation_id": "inv-1",
                "tool_results": [],
            },
            emit=emit,
            pool=_mock_pool(),
            profile_id="prof-1",
        )
        assert "test_inv-1" in events[0].data["rooms"]
        assert "s1" in events[0].data["rooms"]


# ═══════════════════════════════════════════════════════════════════════════
# _find_next_run_id helper
# ═══════════════════════════════════════════════════════════════════════════


class TestFindNextRunId:
    def test_empty_runs(self):
        assert _find_next_run_id([], None) is None

    def test_first_run_no_prev(self):
        runs = [SimpleNamespace(run_id="r1"), SimpleNamespace(run_id="r2")]
        assert _find_next_run_id(runs, None) == "r1"

    def test_next_after_prev(self):
        runs = [
            SimpleNamespace(run_id="r1"),
            SimpleNamespace(run_id="r2"),
            SimpleNamespace(run_id="r3"),
        ]
        assert _find_next_run_id(runs, "r1") == "r2"
        assert _find_next_run_id(runs, "r2") == "r3"

    def test_last_run_returns_none(self):
        runs = [SimpleNamespace(run_id="r1"), SimpleNamespace(run_id="r2")]
        assert _find_next_run_id(runs, "r2") is None

    def test_unknown_prev_returns_none(self):
        runs = [SimpleNamespace(run_id="r1")]
        assert _find_next_run_id(runs, "unknown") is None


# ═══════════════════════════════════════════════════════════════════════════
# test_group_impl
# ═══════════════════════════════════════════════════════════════════════════

_RUNS_SEARCH = "app.routes.v5.tools.entries.runs.search"


@pytest.mark.asyncio
class TestGroupImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await _test_group_impl({}, emit=emit, pool=_mock_pool())
        assert events == []

    async def test_no_profile_emits_nothing(self):
        emit, events = recording_emit()
        await _test_group_impl({"sid": "s1"}, emit=emit, pool=_mock_pool())
        assert events == []

    @patch(f"{_RUNS_SEARCH}.search_runs", new_callable=AsyncMock)
    async def test_no_runs_emits_group_complete(self, mock_search):
        mock_search.return_value = ([], 0)
        emit, events = recording_emit()
        await _test_group_impl(
            {
                "sid": "s1",
                "profile_id": "prof-1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "test_invocation_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917942",
            },
            emit=emit,
            pool=_mock_pool(),
        )
        assert len(events) == 1
        assert events[0].event == "test_group_complete"

    @patch(f"{_RUNS_SEARCH}.search_runs", new_callable=AsyncMock)
    async def test_first_run_emits_test_run(self, mock_search):
        mock_search.return_value = (
            [SimpleNamespace(run_id="r1"), SimpleNamespace(run_id="r2")],
            2,
        )
        emit, events = recording_emit()
        await _test_group_impl(
            {
                "sid": "s1",
                "profile_id": "prof-1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "test_invocation_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917942",
            },
            emit=emit,
            pool=_mock_pool(),
        )
        assert len(events) == 1
        assert events[0].event == "test_run"
        assert events[0].data["run_id"] == "r1"

    @patch(f"{_RUNS_SEARCH}.search_runs", new_callable=AsyncMock)
    async def test_error_emits_test_error(self, mock_search):
        mock_search.side_effect = RuntimeError("db down")
        emit, events = recording_emit()
        await _test_group_impl(
            {
                "sid": "s1",
                "profile_id": "prof-1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "test_invocation_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917942",
            },
            emit=emit,
            pool=_mock_pool(),
        )
        assert len(events) == 1
        assert events[0].event == "test_error"
        assert events[0].data["error_type"] == "group"


# ═══════════════════════════════════════════════════════════════════════════
# test_start_impl
# ═══════════════════════════════════════════════════════════════════════════

_TEST_CREATE = "app.routes.v5.tools.entries.test.create"
_BENCHMARK_CREATE = "app.routes.v5.tools.entries.benchmark_test.create"
_REFRESH = "app.routes.v5.tools.entries.test_invocation.refresh"
_CACHE = "app.utils.cache.invalidate_tags"


@pytest.mark.asyncio
class TestStartImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await _test_start_impl({}, emit=emit, pool=_mock_pool())
        assert events == []

    async def test_no_profile_emits_nothing(self):
        emit, events = recording_emit()
        await _test_start_impl({"sid": "s1"}, emit=emit, pool=_mock_pool())
        assert events == []

    async def test_invalid_profile_id_returns(self):
        emit, events = recording_emit()
        await _test_start_impl(
            {"sid": "s1", "profile_id": "not-a-uuid"},
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    @patch(f"{_CACHE}.invalidate_tags", new_callable=AsyncMock)
    @patch(f"{_REFRESH}.refresh_test_invocation", new_callable=AsyncMock)
    @patch(f"{_TEST_CREATE}.create_test", new_callable=AsyncMock)
    async def test_creates_test_and_emits_proceed(
        self, mock_create, mock_refresh, mock_invalidate
    ):
        mock_create.return_value = SimpleNamespace(
            id="019b3be4-36f0-788c-9df2-481eb5917940"
        )
        emit, events = recording_emit()
        await _test_start_impl(
            {
                "sid": "s1",
                "profile_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "profiles_id": "019b3be4-36f0-788c-9df2-481eb5917942",
            },
            emit=emit,
            pool=_mock_pool(),
        )
        mock_create.assert_called_once()
        mock_refresh.assert_called_once()
        assert len(events) == 1
        assert events[0].event == "test_proceed"
        assert events[0].data["test_id"] == "019b3be4-36f0-788c-9df2-481eb5917940"

    @patch(f"{_CACHE}.invalidate_tags", new_callable=AsyncMock)
    @patch(f"{_REFRESH}.refresh_test_invocation", new_callable=AsyncMock)
    @patch(f"{_TEST_CREATE}.create_test", new_callable=AsyncMock)
    async def test_error_emits_test_error(
        self, mock_create, mock_refresh, mock_invalidate
    ):
        mock_create.side_effect = RuntimeError("db down")
        emit, events = recording_emit()
        await _test_start_impl(
            {
                "sid": "s1",
                "profile_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "profiles_id": "019b3be4-36f0-788c-9df2-481eb5917942",
            },
            emit=emit,
            pool=_mock_pool(),
        )
        assert len(events) == 1
        assert events[0].event == "test_error"
        assert events[0].data["error_type"] == "start"


# ═══════════════════════════════════════════════════════════════════════════
# test_proceed_impl
# ═══════════════════════════════════════════════════════════════════════════

_INV_SEARCH = "app.routes.v5.tools.entries.test_invocation.search"
_INV_CREATE = "app.routes.v5.tools.entries.test_invocation.create"
_INV_BRIDGE = "app.routes.v5.tools.entries.test_invocation_bridge.create"
_INV_COMPLETION = "app.routes.v5.tools.entries.test_invocation_completion.create"
_TEST_GET = "app.routes.v5.tools.entries.test.get"


@pytest.mark.asyncio
class TestProceedImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await _test_proceed_impl({"sid": ""}, emit=emit, pool=_mock_pool())
        assert events == []

    async def test_invalid_payload_emits_nothing(self):
        emit, events = recording_emit()
        await _test_proceed_impl(
            {"sid": "s1"},  # missing test_id
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    @patch(f"{_CACHE}.invalidate_tags", new_callable=AsyncMock)
    @patch(f"{_REFRESH}.refresh_test_invocation", new_callable=AsyncMock)
    @patch(
        f"{_INV_COMPLETION}.create_test_invocation_completion", new_callable=AsyncMock
    )
    @patch(
        f"{_INV_SEARCH}.search_test_invocation_entries_internal", new_callable=AsyncMock
    )
    async def test_complete_all_marks_all_and_emits_ended(
        self, mock_search, mock_complete, mock_refresh, mock_invalidate
    ):
        inv1 = SimpleNamespace(invocation_id="inv-1", invocation_completed=False)
        inv2 = SimpleNamespace(invocation_id="inv-2", invocation_completed=True)
        mock_search.return_value = ([inv1, inv2], 2)

        emit, events = recording_emit()
        await _test_proceed_impl(
            {
                "sid": "s1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "complete_all": True,
            },
            emit=emit,
            pool=_mock_pool(),
        )

        # Only inv1 (uncompleted) should have completion created
        assert mock_complete.call_count == 1
        assert mock_refresh.called
        assert len(events) == 1
        assert events[0].event == "test_ended"
        assert events[0].data["success"] is True

    @patch(f"{_TEST_GET}.get_tests", new_callable=AsyncMock)
    @patch(
        f"{_INV_SEARCH}.search_test_invocation_entries_internal", new_callable=AsyncMock
    )
    async def test_all_completed_emits_ended(self, mock_search, mock_get_tests):
        inv1 = SimpleNamespace(invocation_id="inv-1", invocation_completed=True)
        inv2 = SimpleNamespace(invocation_id="inv-2", invocation_completed=True)
        mock_search.return_value = ([inv1, inv2], 2)
        mock_get_tests.return_value = [SimpleNamespace(is_dynamic=True)]

        emit, events = recording_emit()
        await _test_proceed_impl(
            {
                "sid": "s1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert len(events) == 1
        assert events[0].event == "test_ended"

    @patch(f"{_TEST_GET}.get_tests", new_callable=AsyncMock)
    @patch(
        f"{_INV_SEARCH}.search_test_invocation_entries_internal", new_callable=AsyncMock
    )
    async def test_no_invocations_emits_error(self, mock_search, mock_get_tests):
        mock_search.return_value = ([], 0)
        mock_get_tests.return_value = []

        emit, events = recording_emit()
        await _test_proceed_impl(
            {
                "sid": "s1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert len(events) == 1
        assert events[0].event == "test_error"
        assert events[0].data["error_type"] == "proceed"

    @patch(f"{_TEST_GET}.get_tests", new_callable=AsyncMock)
    @patch(
        f"{_INV_SEARCH}.search_test_invocation_entries_internal", new_callable=AsyncMock
    )
    async def test_use_custom_without_force_emits_started(
        self, mock_search, mock_get_tests
    ):
        inv1 = SimpleNamespace(
            invocation_id="inv-1", invocation_completed=False, use_custom=True
        )
        mock_search.return_value = ([inv1], 1)
        mock_get_tests.return_value = [SimpleNamespace(is_dynamic=True)]

        emit, events = recording_emit()
        await _test_proceed_impl(
            {
                "sid": "s1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert len(events) == 1
        assert events[0].event == "test_started"
        assert events[0].data["invocation_entry_id"] == "inv-1"

    @patch(f"{_CACHE}.invalidate_tags", new_callable=AsyncMock)
    @patch(f"{_REFRESH}.refresh_test_invocation", new_callable=AsyncMock)
    @patch(f"{_INV_BRIDGE}.create_test_invocation_bridge", new_callable=AsyncMock)
    @patch(f"{_INV_CREATE}.create_test_invocation", new_callable=AsyncMock)
    @patch(f"{_TEST_GET}.get_tests", new_callable=AsyncMock)
    @patch(
        f"{_INV_SEARCH}.search_test_invocation_entries_internal", new_callable=AsyncMock
    )
    async def test_next_invocation_creates_and_emits_started(
        self,
        mock_search,
        mock_get_tests,
        mock_create_inv,
        mock_bridge,
        mock_refresh,
        mock_invalidate,
    ):
        inv1 = SimpleNamespace(
            invocation_id="inv-1", invocation_completed=False, use_custom=False
        )
        mock_search.return_value = ([inv1], 1)
        mock_get_tests.return_value = [SimpleNamespace(is_dynamic=False)]
        mock_create_inv.return_value = SimpleNamespace(id="new-inv-id")

        emit, events = recording_emit()
        await _test_proceed_impl(
            {
                "sid": "s1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert mock_create_inv.called
        assert mock_bridge.called
        assert mock_refresh.called
        assert len(events) == 1
        assert events[0].event == "test_invocation_started"
        assert events[0].data["is_dynamic"] is False
        assert events[0].data["test_invocation_id"] == "new-inv-id"

    @patch(
        f"{_INV_COMPLETION}.create_test_invocation_completion", new_callable=AsyncMock
    )
    @patch(f"{_TEST_GET}.get_tests", new_callable=AsyncMock)
    @patch(
        f"{_INV_SEARCH}.search_test_invocation_entries_internal", new_callable=AsyncMock
    )
    async def test_completed_invocation_id_creates_completion(
        self, mock_search, mock_get_tests, mock_complete
    ):
        inv1 = SimpleNamespace(invocation_id="inv-1", invocation_completed=True)
        mock_search.return_value = ([inv1], 1)
        mock_get_tests.return_value = [SimpleNamespace(is_dynamic=True)]

        emit, events = recording_emit()
        await _test_proceed_impl(
            {
                "sid": "s1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "completed_invocation_id": "019b3be4-36f0-788c-9df2-481eb5917943",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert mock_complete.called
        # All completed → test_ended
        assert len(events) == 1
        assert events[0].event == "test_ended"

    @patch(f"{_TEST_GET}.get_tests", new_callable=AsyncMock)
    @patch(
        f"{_INV_SEARCH}.search_test_invocation_entries_internal", new_callable=AsyncMock
    )
    async def test_error_emits_test_error(self, mock_search, mock_get_tests):
        mock_search.side_effect = RuntimeError("db down")

        emit, events = recording_emit()
        await _test_proceed_impl(
            {
                "sid": "s1",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert len(events) == 1
        assert events[0].event == "test_error"
        assert events[0].data["error_type"] == "proceed"


# ═══════════════════════════════════════════════════════════════════════════
# test_run_impl
# ═══════════════════════════════════════════════════════════════════════════

_RUN_CREATE = "app.routes.v5.tools.entries.runs.create"
_MSG_CREATE = "app.routes.v5.tools.entries.messages.create"
_MSG_SEARCH = "app.routes.v5.tools.entries.messages.search"
_INV_GET = "app.routes.v5.tools.entries.test_invocation.get"


@pytest.mark.asyncio
class TestRunImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await _test_run_impl({"sid": ""}, emit=emit, pool=_mock_pool())
        assert events == []

    async def test_no_profile_id_emits_nothing(self):
        emit, events = recording_emit()
        await _test_run_impl(
            {"sid": "s1", "profile_id": ""},
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    async def test_invalid_payload_emits_nothing(self):
        emit, events = recording_emit()
        await _test_run_impl(
            {"sid": "s1", "profile_id": "p1"},  # missing test_id etc
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    @patch(f"{_INV_GET}.get_test_invocations", new_callable=AsyncMock)
    async def test_no_invocation_emits_error(self, mock_get_inv):
        mock_get_inv.return_value = []

        emit, events = recording_emit()
        await _test_run_impl(
            {
                "sid": "s1",
                "profile_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "test_invocation_id": "019b3be4-36f0-788c-9df2-481eb5917942",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917943",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert len(events) == 1
        assert events[0].event == "test_error"
        assert events[0].data["error_type"] == "run"

    @patch(f"{_MSG_CREATE}.create_message", new_callable=AsyncMock)
    @patch(f"{_MSG_SEARCH}.search_messages", new_callable=AsyncMock)
    @patch(f"{_RUN_CREATE}.create_run", new_callable=AsyncMock)
    @patch(f"{_INV_GET}.get_test_invocations", new_callable=AsyncMock)
    async def test_no_messages_emits_error(
        self, mock_get_inv, mock_create_run, mock_search_msg, mock_create_msg
    ):
        from uuid import UUID

        mock_get_inv.return_value = [
            SimpleNamespace(group_id=UUID("019b3be4-36f0-788c-9df2-481eb5917950"))
        ]
        mock_create_run.return_value = SimpleNamespace(
            id=UUID("019b3be4-36f0-788c-9df2-481eb5917951")
        )
        mock_search_msg.return_value = ([], 0)

        emit, events = recording_emit()
        await _test_run_impl(
            {
                "sid": "s1",
                "profile_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "test_invocation_id": "019b3be4-36f0-788c-9df2-481eb5917942",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917943",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert len(events) == 1
        assert events[0].event == "test_error"
        assert "No messages" in events[0].data["message"]

    @patch(f"{_MSG_CREATE}.create_message", new_callable=AsyncMock)
    @patch(f"{_MSG_SEARCH}.search_messages", new_callable=AsyncMock)
    @patch(f"{_RUN_CREATE}.create_run", new_callable=AsyncMock)
    @patch(f"{_INV_GET}.get_test_invocations", new_callable=AsyncMock)
    async def test_happy_path_emits_run_started_and_generate(
        self, mock_get_inv, mock_create_run, mock_search_msg, mock_create_msg
    ):
        from datetime import datetime
        from uuid import UUID

        mock_get_inv.return_value = [
            SimpleNamespace(group_id=UUID("019b3be4-36f0-788c-9df2-481eb5917950"))
        ]
        new_run_id = UUID("019b3be4-36f0-788c-9df2-481eb5917951")
        assistant_msg_id = UUID("019b3be4-36f0-788c-9df2-481eb5917960")
        mock_create_run.return_value = SimpleNamespace(id=new_run_id)

        # Original messages: user, assistant (last assistant gets removed)
        mock_search_msg.return_value = (
            [
                SimpleNamespace(role="user", message_id=UUID(int=1)),
                SimpleNamespace(role="assistant", message_id=UUID(int=2)),
            ],
            2,
        )

        call_count = 0

        async def fake_create_message(conn, *, run_id, role, **kwargs):
            nonlocal call_count
            call_count += 1
            return SimpleNamespace(
                id=assistant_msg_id
                if role == "assistant"
                else UUID(int=10 + call_count),
                created_at=datetime.now(),
            )

        mock_create_msg.side_effect = fake_create_message

        emit, events = recording_emit()
        await _test_run_impl(
            {
                "sid": "s1",
                "profile_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "test_invocation_id": "019b3be4-36f0-788c-9df2-481eb5917942",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917943",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        # 1 user msg copied + 1 assistant placeholder = 2 calls
        assert call_count == 2
        assert len(events) == 2
        assert events[0].event == "test_run_started"
        assert events[0].data["run_id"] == str(new_run_id)
        assert events[0].data["message_id"] == str(assistant_msg_id)
        assert events[1].event == "generate_artifact"
        assert events[1].data["artifact_type"] == "test"

    @patch(f"{_RUN_CREATE}.create_run", new_callable=AsyncMock)
    @patch(f"{_INV_GET}.get_test_invocations", new_callable=AsyncMock)
    async def test_error_emits_test_error(self, mock_get_inv, mock_create_run):
        from uuid import UUID

        mock_get_inv.return_value = [
            SimpleNamespace(group_id=UUID("019b3be4-36f0-788c-9df2-481eb5917950"))
        ]
        mock_create_run.side_effect = RuntimeError("db down")

        emit, events = recording_emit()
        await _test_run_impl(
            {
                "sid": "s1",
                "profile_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "test_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "test_invocation_id": "019b3be4-36f0-788c-9df2-481eb5917942",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917943",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert len(events) == 1
        assert events[0].event == "test_error"
        assert events[0].data["error_type"] == "run"


# ═══════════════════════════════════════════════════════════════════════════
# user_complete_impl
# ═══════════════════════════════════════════════════════════════════════════

_ATTEMPT_MSG_SEARCH = "app.routes.v5.tools.entries.attempt_message.search"
_ATTEMPT_CONTENT = "app.routes.v5.tools.entries.attempt_content.create"
_ATTEMPT_MSG_COMPLETION = (
    "app.routes.v5.tools.entries.attempt_message_completion.create"
)


@pytest.mark.asyncio
class TestUserCompleteImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await _user_complete_impl(
            {"sid": "", "chat_id": "c1", "run_id": "r1", "content": "hi"},
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    async def test_no_content_emits_nothing(self):
        emit, events = recording_emit()
        await _user_complete_impl(
            {"sid": "s1", "chat_id": "c1", "run_id": "r1", "content": ""},
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    @patch(f"{_ATTEMPT_MSG_SEARCH}.search_attempt_messages", new_callable=AsyncMock)
    async def test_no_open_message_emits_nothing(self, mock_search):
        mock_search.return_value = ([], 0)
        emit, events = recording_emit()
        await _user_complete_impl(
            {
                "sid": "s1",
                "chat_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "content": "hello",
            },
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    @patch(
        "app.routes.v5.tools.entries.calls.create.create_call",
        new_callable=AsyncMock,
        return_value=SimpleNamespace(id=UUID(int=77)),
    )
    @patch(
        f"{_ATTEMPT_MSG_COMPLETION}.create_attempt_message_completion",
        new_callable=AsyncMock,
    )
    @patch(f"{_ATTEMPT_CONTENT}.create_attempt_content", new_callable=AsyncMock)
    @patch(f"{_ATTEMPT_MSG_SEARCH}.search_attempt_messages", new_callable=AsyncMock)
    async def test_happy_path_emits_user_complete(
        self, mock_search, mock_content, mock_completion, mock_call
    ):
        from datetime import datetime
        from uuid import UUID

        msg_id = UUID("019b3be4-36f0-788c-9df2-481eb5917950")
        mock_search.return_value = (
            [
                SimpleNamespace(
                    message_id=msg_id,
                    type="user",
                    completed=False,
                    created_at=datetime(2026, 1, 1),
                ),
            ],
            1,
        )

        emit, events = recording_emit()
        await _user_complete_impl(
            {
                "sid": "s1",
                "chat_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "content": "hello world",
            },
            emit=emit,
            pool=_mock_pool(),
        )

        assert mock_content.called
        assert mock_completion.called
        assert len(events) == 1
        assert events[0].event == "attempt_user_complete"
        assert events[0].data["message_id"] == str(msg_id)
        assert events[0].data["content"] == "hello world"

    @patch(f"{_ATTEMPT_MSG_SEARCH}.search_attempt_messages", new_callable=AsyncMock)
    async def test_filters_completed_messages(self, mock_search):
        from datetime import datetime
        from uuid import UUID

        mock_search.return_value = (
            [
                SimpleNamespace(
                    message_id=UUID(int=1),
                    type="user",
                    completed=True,
                    created_at=datetime(2026, 1, 1),
                ),
                SimpleNamespace(
                    message_id=UUID(int=2),
                    type="assistant",
                    completed=False,
                    created_at=datetime(2026, 1, 1),
                ),
            ],
            2,
        )

        emit, events = recording_emit()
        await _user_complete_impl(
            {
                "sid": "s1",
                "chat_id": "019b3be4-36f0-788c-9df2-481eb5917940",
                "run_id": "019b3be4-36f0-788c-9df2-481eb5917941",
                "content": "hello",
            },
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []


# ═══════════════════════════════════════════════════════════════════════════
# speech_complete_impl
# ═══════════════════════════════════════════════════════════════════════════

_UPLOAD_CREATE = "app.routes.v5.tools.entries.uploads.create"


@pytest.mark.asyncio
class TestSpeechCompleteImpl:
    async def test_no_group_id_emits_nothing(self):
        emit, events = recording_emit()
        await _speech_complete_impl({"group_id": ""}, emit=emit, pool=_mock_pool())
        assert events == []

    @patch(f"{_P}.get_session_by_group_id", return_value=None)
    async def test_no_session_emits_nothing(self, _mock):
        emit, events = recording_emit()
        await _speech_complete_impl({"group_id": "g1"}, emit=emit, pool=_mock_pool())
        assert events == []

    @patch(f"{_P}.get_session_by_group_id")
    async def test_empty_transcript_emits_nothing(self, mock_session):
        mock_session.return_value = SimpleNamespace(sid="s1", chat_id="c1", run_id="r1")
        emit, events = recording_emit()
        await _speech_complete_impl(
            {"group_id": "g1", "transcript": ""},
            emit=emit,
            pool=_mock_pool(),
        )
        assert events == []

    @patch(f"{_P}.get_session_by_group_id")
    async def test_transcript_only_emits_received_complete(self, mock_session):
        mock_session.return_value = SimpleNamespace(sid="s1", chat_id="c1", run_id="r1")
        emit, events = recording_emit()
        await _speech_complete_impl(
            {"group_id": "g1", "transcript": "hello world"},
            emit=emit,
            pool=_mock_pool(),
        )

        assert len(events) == 1
        assert events[0].event == "attempt_user_received_complete"
        assert events[0].data["content"] == "hello world"
        assert events[0].data["audio_upload_id"] is None

    @patch(f"{_UPLOAD_CREATE}.create_upload", new_callable=AsyncMock)
    @patch(f"{_P}.get_session_by_group_id")
    async def test_with_audio_creates_upload(self, mock_session, mock_upload, tmp_path):
        from uuid import UUID

        mock_session.return_value = SimpleNamespace(sid="s1", chat_id="c1", run_id="r1")
        mock_upload.return_value = SimpleNamespace(
            id=UUID("019b3be4-36f0-788c-9df2-481eb5917960")
        )

        emit, events = recording_emit()
        with patch("app.infra.globals.AUDIO_FOLDER", tmp_path):
            await _speech_complete_impl(
                {
                    "group_id": "g1",
                    "transcript": "hello",
                    "audio": b"fake-audio-bytes",
                },
                emit=emit,
                pool=_mock_pool(),
            )

        assert len(events) == 1
        assert (
            events[0].data["audio_upload_id"] == "019b3be4-36f0-788c-9df2-481eb5917960"
        )


# ═══════════════════════════════════════════════════════════════════════════
# attempt_start_impl
# ═══════════════════════════════════════════════════════════════════════════

_PROFILE_CTX = "app.infra.profile_identity_context"
_ATTEMPT_CREATE = "app.routes.v5.tools.entries.attempt.create"
_ATTEMPT_REFRESH = "app.routes.v5.tools.entries.attempt.refresh"
_ATTEMPT_CHAT_REFRESH = "app.routes.v5.tools.entries.attempt_chat.refresh"
_ATTEMPT_PRACTICE = "app.routes.v5.tools.entries.attempt_practice.create"
_ATTEMPT_HOME = "app.routes.v5.tools.entries.attempt_home.create"
_CALLS_CREATE = "app.routes.v5.tools.entries.calls.create"
_PERSONA_CREATE = "app.routes.v5.tools.entries.persona.create"
_PRACTICE_GET = "app.routes.v5.tools.entries.practice.get"
_PRACTICE_CHAT_SEARCH = "app.routes.v5.tools.entries.practice_chat.search"
_PROFILE_PERSONAS_GET = "app.routes.v5.tools.resources.profile_personas.get"
_SIMULATIONS_GET = "app.routes.v5.tools.resources.simulations.get"


@pytest.mark.asyncio
class TestAttemptStartImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await _attempt_start_impl(
            {"sid": ""},
            emit=emit,
            pool=_mock_pool(),
            profile_id="p1",
            session_id="s1",
        )
        assert events == []

    async def test_invalid_payload_emits_nothing(self):
        emit, events = recording_emit()
        await _attempt_start_impl(
            {"sid": "s1"},  # missing practice_id/home_id
            emit=emit,
            pool=_mock_pool(),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )
        assert events == []

    @patch(f"{_PROFILE_CTX}.resolve_profile_identity_context", new_callable=AsyncMock)
    async def test_no_profile_resource_emits_error(self, mock_ctx):
        mock_ctx.return_value = None

        emit, events = recording_emit()
        await _attempt_start_impl(
            {
                "sid": "s1",
                "practice_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
            },
            emit=emit,
            pool=_mock_pool(),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        assert len(events) == 1
        assert events[0].event == "attempt_error"
        assert events[0].data["error_type"] == "start"

    @patch(f"{_ATTEMPT_CHAT_REFRESH}.refresh_attempt_chat", new_callable=AsyncMock)
    @patch(f"{_ATTEMPT_REFRESH}.refresh_attempt", new_callable=AsyncMock)
    @patch(f"{_ATTEMPT_PRACTICE}.create_attempt_practice", new_callable=AsyncMock)
    @patch(f"{_ATTEMPT_CREATE}.create_attempt", new_callable=AsyncMock)
    @patch(f"{_CALLS_CREATE}.create_call", new_callable=AsyncMock)
    @patch(f"{_PERSONA_CREATE}.create_persona", new_callable=AsyncMock)
    @patch(f"{_RUN_CREATE}.create_run", new_callable=AsyncMock)
    @patch(f"{_SIMULATIONS_GET}.get_simulations", new_callable=AsyncMock)
    @patch(f"{_PRACTICE_CHAT_SEARCH}.search_practice_chats", new_callable=AsyncMock)
    @patch(f"{_PROFILE_PERSONAS_GET}.get_profile_personas", new_callable=AsyncMock)
    @patch(f"{_PRACTICE_GET}.get_practices", new_callable=AsyncMock)
    @patch(f"{_PROFILE_CTX}.resolve_profile_identity_context", new_callable=AsyncMock)
    async def test_happy_path_practice_emits_proceed(
        self,
        mock_ctx,
        mock_practices,
        mock_profile_personas,
        mock_practice_chats,
        mock_simulations,
        mock_create_run,
        mock_create_persona,
        mock_create_call,
        mock_create_attempt,
        mock_create_practice,
        mock_refresh_attempt,
        mock_refresh_chat,
    ):
        from uuid import UUID

        profiles_id = UUID("019b3be4-36f0-788c-9df2-481eb5917960")
        persona_id = UUID("019b3be4-36f0-788c-9df2-481eb5917961")
        attempt_id = UUID("019b3be4-36f0-788c-9df2-481eb5917970")

        mock_ctx.return_value = SimpleNamespace(profiles_id=profiles_id)
        mock_practices.return_value = [
            SimpleNamespace(
                profile_ids=[UUID(int=1)],
                simulation_ids=[UUID(int=2)],
            )
        ]
        mock_profile_personas.return_value = [
            SimpleNamespace(profile_id=profiles_id, persona_id=persona_id)
        ]
        mock_practice_chats.return_value = [SimpleNamespace(), SimpleNamespace()]
        mock_simulations.return_value = [
            SimpleNamespace(name="Sim1", description="Desc1")
        ]
        mock_create_run.return_value = SimpleNamespace(id=UUID(int=10))
        mock_create_persona.return_value = SimpleNamespace(id=UUID(int=11))
        mock_create_call.return_value = SimpleNamespace(id=UUID(int=12))
        mock_create_attempt.return_value = SimpleNamespace(id=attempt_id)

        from contextlib import asynccontextmanager
        from unittest.mock import MagicMock

        @asynccontextmanager
        async def fake_txn():
            yield

        emit, events = recording_emit()
        mock_conn = AsyncMock()
        mock_conn.transaction = MagicMock(side_effect=lambda: fake_txn())
        await _attempt_start_impl(
            {
                "sid": "s1",
                "practice_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
            },
            emit=emit,
            pool=_mock_pool(mock_conn),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        assert mock_create_run.called
        assert mock_create_persona.called
        assert mock_create_attempt.called
        assert mock_create_practice.called
        assert mock_refresh_attempt.called
        assert len(events) == 1
        assert events[0].event == "attempt_proceed"
        assert events[0].data["attempt_id"] == str(attempt_id)

    @patch(f"{_PROFILE_CTX}.resolve_profile_identity_context", new_callable=AsyncMock)
    async def test_error_emits_attempt_error(self, mock_ctx):
        mock_ctx.side_effect = RuntimeError("db down")

        emit, events = recording_emit()
        await _attempt_start_impl(
            {
                "sid": "s1",
                "practice_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
            },
            emit=emit,
            pool=_mock_pool(),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        assert len(events) == 1
        assert events[0].event == "attempt_error"
        assert events[0].data["error_type"] == "start"


# ═══════════════════════════════════════════════════════════════════════════
# emit_chat_generate_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestEmitChatGenerateImpl:
    _GROUPS = "app.routes.v5.tools.entries.groups.create.create_group"
    _RUNS = "app.routes.v5.tools.entries.runs.create.create_run"

    @patch(_RUNS, new_callable=AsyncMock)
    @patch(_GROUPS, new_callable=AsyncMock)
    async def test_emits_generate_event(self, mock_group, mock_run):
        mock_group.return_value = SimpleNamespace(id=UUID(int=1))
        mock_run.return_value = SimpleNamespace(id=UUID(int=2))

        emit, events = recording_emit()
        await _emit_chat_generate_impl(
            emit=emit,
            pool=_mock_pool(),
            sid="s1",
            profile_id=UUID(int=10),
            profiles_id=UUID(int=11),
            session_id=UUID(int=12),
            attempt_id=UUID(int=20),
            chat_entry_id=UUID(int=30),
            department_id=UUID(int=40),
            attempt_chat_id=UUID(int=50),
        )

        assert len(events) == 1
        assert events[0].event == "generate"
        assert events[0].data["profile_id"] == str(UUID(int=10))
        assert events[0].data["artifact_id"] == str(UUID(int=30))
        assert events[0].data["run_id"] == str(UUID(int=2))
        assert events[0].data["group_id"] == str(UUID(int=1))
        assert events[0].data["metadata"]["attempt_id"] == str(UUID(int=20))

    @patch(_RUNS, new_callable=AsyncMock)
    @patch(_GROUPS, new_callable=AsyncMock)
    async def test_uses_default_resource_types(self, mock_group, mock_run):
        mock_group.return_value = SimpleNamespace(id=UUID(int=1))
        mock_run.return_value = SimpleNamespace(id=UUID(int=2))

        emit, events = recording_emit()
        await _emit_chat_generate_impl(
            emit=emit,
            pool=_mock_pool(),
            sid="s1",
            profile_id=UUID(int=10),
            profiles_id=UUID(int=11),
            session_id=UUID(int=12),
            attempt_id=UUID(int=20),
            chat_entry_id=UUID(int=30),
            department_id=UUID(int=40),
            attempt_chat_id=None,
        )

        data = events[0].data
        assert data["resource_types"] == [
            "personas",
            "scenarios",
            "parameters",
            "fields",
        ]
        assert data["metadata"]["attempt_chat_id"] is None

    @patch(_RUNS, new_callable=AsyncMock)
    @patch(_GROUPS, new_callable=AsyncMock)
    async def test_custom_resource_types(self, mock_group, mock_run):
        mock_group.return_value = SimpleNamespace(id=UUID(int=1))
        mock_run.return_value = SimpleNamespace(id=UUID(int=2))

        emit, events = recording_emit()
        await _emit_chat_generate_impl(
            emit=emit,
            pool=_mock_pool(),
            sid="s1",
            profile_id=UUID(int=10),
            profiles_id=UUID(int=11),
            session_id=UUID(int=12),
            attempt_id=UUID(int=20),
            chat_entry_id=UUID(int=30),
            department_id=UUID(int=40),
            attempt_chat_id=UUID(int=50),
            resource_types=["personas", "documents"],
        )

        assert events[0].data["resource_types"] == ["personas", "documents"]

    @patch(_RUNS, new_callable=AsyncMock)
    @patch(_GROUPS, new_callable=AsyncMock)
    async def test_passes_draft_id(self, mock_group, mock_run):
        mock_group.return_value = SimpleNamespace(id=UUID(int=1))
        mock_run.return_value = SimpleNamespace(id=UUID(int=2))

        emit, events = recording_emit()
        draft = UUID(int=99)
        await _emit_chat_generate_impl(
            emit=emit,
            pool=_mock_pool(),
            sid="s1",
            profile_id=UUID(int=10),
            profiles_id=UUID(int=11),
            session_id=UUID(int=12),
            attempt_id=UUID(int=20),
            chat_entry_id=UUID(int=30),
            department_id=UUID(int=40),
            attempt_chat_id=UUID(int=50),
            draft_id=draft,
        )

        assert events[0].data["draft_id"] == str(draft)

    @patch(_RUNS, new_callable=AsyncMock)
    @patch(_GROUPS, new_callable=AsyncMock)
    async def test_creates_group_and_run(self, mock_group, mock_run):
        mock_group.return_value = SimpleNamespace(id=UUID(int=1))
        mock_run.return_value = SimpleNamespace(id=UUID(int=2))

        emit, events = recording_emit()
        mock_conn = AsyncMock()
        session_id = UUID(int=12)
        profiles_id = UUID(int=11)

        await _emit_chat_generate_impl(
            emit=emit,
            pool=_mock_pool(mock_conn),
            sid="s1",
            profile_id=UUID(int=10),
            profiles_id=profiles_id,
            session_id=session_id,
            attempt_id=UUID(int=20),
            chat_entry_id=UUID(int=30),
            department_id=UUID(int=40),
            attempt_chat_id=UUID(int=50),
        )

        mock_group.assert_called_once_with(mock_conn, session_id=session_id)
        mock_run.assert_called_once_with(
            mock_conn,
            session_id=session_id,
            group_id=UUID(int=1),
            profiles_id=profiles_id,
        )


# ═══════════════════════════════════════════════════════════════════════════
# attempt_proceed_impl
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestAttemptProceedImpl:
    _RUNS = "app.routes.v5.tools.entries.runs.create.create_run"
    _GET_ATTEMPTS = "app.routes.v5.tools.entries.attempt.get.get_attempts"
    _BRIDGES = "app.routes.v5.tools.entries.attempt_chat_bridge.search.search_attempt_chat_bridges"
    _SEARCH_CHATS = (
        "app.routes.v5.tools.entries.attempt_chat.search.search_attempt_chats"
    )
    _PRACTICE_ENTRIES = "app.routes.v5.tools.entries.attempt_practice.search.search_attempt_practice_entries"
    _HOME_ENTRIES = (
        "app.routes.v5.tools.entries.attempt_home.search.search_attempt_homes"
    )
    _PRACTICE_CHATS = (
        "app.routes.v5.tools.entries.practice_chat.search.search_practice_chats"
    )
    _HOME_CHATS = "app.routes.v5.tools.entries.home_chat.search.search_home_chats"
    _CHAT_ENTRIES = "app.routes.v5.tools.entries.chat.get.get_chat_entries_internal"
    _CREATE_CALL = "app.routes.v5.tools.entries.calls.create.create_call"
    _CREATE_CHAT = "app.routes.v5.tools.entries.attempt_chat.create.create_attempt_chat"
    _CREATE_BRIDGE = "app.routes.v5.tools.entries.attempt_chat_bridge.create.create_attempt_chat_bridge"
    _REFRESH_ATTEMPT = "app.routes.v5.tools.entries.attempt.refresh.refresh_attempt"
    _REFRESH_CHAT = (
        "app.routes.v5.tools.entries.attempt_chat.refresh.refresh_attempt_chat"
    )
    _CHAT_COMPLETION = "app.routes.v5.tools.entries.attempt_chat_completion.create.create_attempt_chat_completion"
    _EMIT_GENERATE = f"{_P}.emit_chat_generate_impl"

    async def test_no_sid_returns_early(self):
        emit, events = recording_emit()
        await _attempt_proceed_impl(
            {"sid": ""},
            emit=emit,
            pool=_mock_pool(),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )
        assert len(events) == 0

    async def test_invalid_payload_returns_early(self):
        emit, events = recording_emit()
        await _attempt_proceed_impl(
            {"sid": "s1"},  # missing attempt_id, group_id
            emit=emit,
            pool=_mock_pool(),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )
        assert len(events) == 0

    @patch(_CHAT_COMPLETION, new_callable=AsyncMock)
    @patch(_BRIDGES, new_callable=AsyncMock)
    @patch(_REFRESH_CHAT, new_callable=AsyncMock)
    @patch(_REFRESH_ATTEMPT, new_callable=AsyncMock)
    @patch(
        _CREATE_CALL,
        new_callable=AsyncMock,
        return_value=SimpleNamespace(id=UUID(int=77)),
    )
    @patch(_RUNS, new_callable=AsyncMock)
    async def test_complete_all_emits_ended(
        self,
        mock_run,
        mock_call,
        mock_refresh_a,
        mock_refresh_c,
        mock_bridges,
        mock_completion,
    ):
        mock_run.return_value = SimpleNamespace(id=UUID(int=1))
        mock_bridges.return_value = [
            SimpleNamespace(attempt_chat_id=UUID(int=10)),
            SimpleNamespace(attempt_chat_id=UUID(int=11)),
        ]

        from contextlib import asynccontextmanager
        from unittest.mock import MagicMock

        @asynccontextmanager
        async def fake_txn():
            yield

        mock_conn = AsyncMock()
        mock_conn.transaction = MagicMock(side_effect=lambda: fake_txn())

        emit, events = recording_emit()
        await _attempt_proceed_impl(
            {
                "sid": "s1",
                "attempt_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
                "complete_all": True,
            },
            emit=emit,
            pool=_mock_pool(mock_conn),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        assert len(events) == 1
        assert events[0].event == "attempt_ended"
        assert events[0].data["all_scenarios_complete"] is True
        assert mock_completion.call_count == 2

    @patch(_REFRESH_CHAT, new_callable=AsyncMock)
    @patch(_REFRESH_ATTEMPT, new_callable=AsyncMock)
    @patch(_CREATE_BRIDGE, new_callable=AsyncMock)
    @patch(_CREATE_CHAT, new_callable=AsyncMock)
    @patch(_CREATE_CALL, new_callable=AsyncMock)
    @patch(_CHAT_ENTRIES, new_callable=AsyncMock)
    @patch(_PRACTICE_CHATS, new_callable=AsyncMock)
    @patch(_PRACTICE_ENTRIES, new_callable=AsyncMock)
    @patch(_SEARCH_CHATS, new_callable=AsyncMock)
    @patch(_BRIDGES, new_callable=AsyncMock)
    @patch(_GET_ATTEMPTS, new_callable=AsyncMock)
    @patch(_RUNS, new_callable=AsyncMock)
    async def test_all_done_emits_ended(
        self,
        mock_run,
        mock_get_attempt,
        mock_bridges,
        mock_search_chats,
        mock_practice_entries,
        mock_practice_chats,
        mock_chat_entries,
        mock_call,
        mock_create_chat,
        mock_create_bridge,
        mock_refresh_a,
        mock_refresh_c,
    ):
        mock_run.return_value = SimpleNamespace(id=UUID(int=1))
        mock_get_attempt.return_value = [
            SimpleNamespace(num_chats=1, practice=True, department_id=UUID(int=40))
        ]
        # 1 bridge already = completed_count >= num_chats
        mock_bridges.return_value = [SimpleNamespace(attempt_chat_id=UUID(int=10))]
        mock_search_chats.return_value = (
            [SimpleNamespace(chat_entry_id=UUID(int=30))],
            1,
        )

        from contextlib import asynccontextmanager
        from unittest.mock import MagicMock

        @asynccontextmanager
        async def fake_txn():
            yield

        mock_conn = AsyncMock()
        mock_conn.transaction = MagicMock(side_effect=lambda: fake_txn())

        emit, events = recording_emit()
        await _attempt_proceed_impl(
            {
                "sid": "s1",
                "attempt_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
            },
            emit=emit,
            pool=_mock_pool(mock_conn),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        assert len(events) == 1
        assert events[0].event == "attempt_ended"

    @patch(_REFRESH_CHAT, new_callable=AsyncMock)
    @patch(_REFRESH_ATTEMPT, new_callable=AsyncMock)
    @patch(_CREATE_BRIDGE, new_callable=AsyncMock)
    @patch(_CREATE_CHAT, new_callable=AsyncMock)
    @patch(_CREATE_CALL, new_callable=AsyncMock)
    @patch(_CHAT_ENTRIES, new_callable=AsyncMock)
    @patch(_PRACTICE_CHATS, new_callable=AsyncMock)
    @patch(_PRACTICE_ENTRIES, new_callable=AsyncMock)
    @patch(_SEARCH_CHATS, new_callable=AsyncMock)
    @patch(_BRIDGES, new_callable=AsyncMock)
    @patch(_GET_ATTEMPTS, new_callable=AsyncMock)
    @patch(_RUNS, new_callable=AsyncMock)
    async def test_no_generation_emits_chat_started(
        self,
        mock_run,
        mock_get_attempt,
        mock_bridges,
        mock_search_chats,
        mock_practice_entries,
        mock_practice_chats,
        mock_chat_entries,
        mock_call,
        mock_create_chat,
        mock_create_bridge,
        mock_refresh_a,
        mock_refresh_c,
    ):
        chat_entry_id = UUID(int=30)
        attempt_chat_id = UUID(int=60)

        mock_run.return_value = SimpleNamespace(id=UUID(int=1))
        mock_get_attempt.return_value = [
            SimpleNamespace(num_chats=2, practice=True, department_id=UUID(int=40))
        ]
        mock_bridges.return_value = []  # no bridges yet
        mock_search_chats.return_value = ([], 0)
        mock_practice_entries.return_value = [
            SimpleNamespace(practice_id=UUID(int=100))
        ]
        mock_practice_chats.return_value = [SimpleNamespace(chat_id=chat_entry_id)]
        mock_chat_entries.return_value = [
            {
                "chat_entry_id": str(chat_entry_id),
                "name": "Scenario 1",
                "position": 0,
                "department_ids": [str(UUID(int=40))],
                "created_at": "2024-01-01",
            }
        ]
        mock_call.return_value = SimpleNamespace(id=UUID(int=5))
        mock_create_chat.return_value = SimpleNamespace(id=attempt_chat_id)

        from contextlib import asynccontextmanager
        from unittest.mock import MagicMock

        @asynccontextmanager
        async def fake_txn():
            yield

        mock_conn = AsyncMock()
        mock_conn.transaction = MagicMock(side_effect=lambda: fake_txn())

        emit, events = recording_emit()
        await _attempt_proceed_impl(
            {
                "sid": "s1",
                "attempt_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
            },
            emit=emit,
            pool=_mock_pool(mock_conn),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        assert len(events) == 1
        assert events[0].event == "attempt_chat_started"
        assert events[0].data["attempt_id"] == "019b3be4-36f0-788c-9df2-481eb5917950"
        assert events[0].data["chat_id"] == str(attempt_chat_id)

    @patch(_EMIT_GENERATE, new_callable=AsyncMock)
    @patch(_CREATE_BRIDGE, new_callable=AsyncMock)
    @patch(_CREATE_CHAT, new_callable=AsyncMock)
    @patch(_CREATE_CALL, new_callable=AsyncMock)
    @patch(_CHAT_ENTRIES, new_callable=AsyncMock)
    @patch(_PRACTICE_CHATS, new_callable=AsyncMock)
    @patch(_PRACTICE_ENTRIES, new_callable=AsyncMock)
    @patch(_SEARCH_CHATS, new_callable=AsyncMock)
    @patch(_BRIDGES, new_callable=AsyncMock)
    @patch(_GET_ATTEMPTS, new_callable=AsyncMock)
    @patch(_RUNS, new_callable=AsyncMock)
    async def test_with_generation_calls_emit_chat_generate(
        self,
        mock_run,
        mock_get_attempt,
        mock_bridges,
        mock_search_chats,
        mock_practice_entries,
        mock_practice_chats,
        mock_chat_entries,
        mock_call,
        mock_create_chat,
        mock_create_bridge,
        mock_emit_gen,
    ):
        chat_entry_id = UUID(int=30)
        attempt_chat_id = UUID(int=60)

        mock_run.return_value = SimpleNamespace(id=UUID(int=1))
        mock_get_attempt.return_value = [
            SimpleNamespace(num_chats=2, practice=True, department_id=UUID(int=40))
        ]
        mock_bridges.return_value = []
        mock_search_chats.return_value = ([], 0)
        mock_practice_entries.return_value = [
            SimpleNamespace(practice_id=UUID(int=100))
        ]
        mock_practice_chats.return_value = [SimpleNamespace(chat_id=chat_entry_id)]
        mock_chat_entries.return_value = [
            {
                "chat_entry_id": str(chat_entry_id),
                "name": "Scenario 1",
                "position": 0,
                "department_ids": [str(UUID(int=40))],
                "generate_personas": True,
                "created_at": "2024-01-01",
            }
        ]
        mock_call.return_value = SimpleNamespace(id=UUID(int=5))
        mock_create_chat.return_value = SimpleNamespace(id=attempt_chat_id)

        from contextlib import asynccontextmanager
        from unittest.mock import MagicMock

        @asynccontextmanager
        async def fake_txn():
            yield

        mock_conn = AsyncMock()
        mock_conn.transaction = MagicMock(side_effect=lambda: fake_txn())

        emit, events = recording_emit()
        await _attempt_proceed_impl(
            {
                "sid": "s1",
                "attempt_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
            },
            emit=emit,
            pool=_mock_pool(mock_conn),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        mock_emit_gen.assert_called_once()
        call_kwargs = mock_emit_gen.call_args.kwargs
        assert call_kwargs["resource_types"] == ["personas"]
        assert call_kwargs["attempt_chat_id"] == attempt_chat_id

    @patch(_CHAT_ENTRIES, new_callable=AsyncMock)
    @patch(_PRACTICE_CHATS, new_callable=AsyncMock)
    @patch(_PRACTICE_ENTRIES, new_callable=AsyncMock)
    @patch(_SEARCH_CHATS, new_callable=AsyncMock)
    @patch(_BRIDGES, new_callable=AsyncMock)
    @patch(_GET_ATTEMPTS, new_callable=AsyncMock)
    @patch(
        _CREATE_CALL,
        new_callable=AsyncMock,
        return_value=SimpleNamespace(id=UUID(int=77)),
    )
    @patch(_RUNS, new_callable=AsyncMock)
    async def test_user_choice_emits_started(
        self,
        mock_run,
        mock_call,
        mock_get_attempt,
        mock_bridges,
        mock_search_chats,
        mock_practice_entries,
        mock_practice_chats,
        mock_chat_entries,
    ):
        chat_entry_id = UUID(int=30)

        mock_run.return_value = SimpleNamespace(id=UUID(int=1))
        mock_get_attempt.return_value = [
            SimpleNamespace(num_chats=2, practice=True, department_id=UUID(int=40))
        ]
        mock_bridges.return_value = []
        mock_search_chats.return_value = ([], 0)
        mock_practice_entries.return_value = [
            SimpleNamespace(practice_id=UUID(int=100))
        ]
        mock_practice_chats.return_value = [SimpleNamespace(chat_id=chat_entry_id)]
        mock_chat_entries.return_value = [
            {
                "chat_entry_id": str(chat_entry_id),
                "name": "Scenario 1",
                "position": 0,
                "department_ids": [str(UUID(int=40))],
                "use_custom": True,
                "created_at": "2024-01-01",
            }
        ]

        from contextlib import asynccontextmanager
        from unittest.mock import MagicMock

        @asynccontextmanager
        async def fake_txn():
            yield

        mock_conn = AsyncMock()
        mock_conn.transaction = MagicMock(side_effect=lambda: fake_txn())

        emit, events = recording_emit()
        await _attempt_proceed_impl(
            {
                "sid": "s1",
                "attempt_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
            },
            emit=emit,
            pool=_mock_pool(mock_conn),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        assert len(events) == 1
        assert events[0].event == "attempt_started"
        assert events[0].data["chat_entry_id"] == str(chat_entry_id)

    @patch(_RUNS, new_callable=AsyncMock)
    async def test_error_emits_attempt_error(self, mock_run):
        mock_run.side_effect = RuntimeError("db down")

        from contextlib import asynccontextmanager
        from unittest.mock import MagicMock

        @asynccontextmanager
        async def fake_txn():
            yield

        mock_conn = AsyncMock()
        mock_conn.transaction = MagicMock(side_effect=lambda: fake_txn())

        emit, events = recording_emit()
        await _attempt_proceed_impl(
            {
                "sid": "s1",
                "attempt_id": "019b3be4-36f0-788c-9df2-481eb5917950",
                "group_id": "019b3be4-36f0-788c-9df2-481eb5917951",
            },
            emit=emit,
            pool=_mock_pool(mock_conn),
            profile_id="019b3be4-36f0-788c-9df2-481eb5917941",
            session_id="019b3be4-36f0-788c-9df2-481eb5917942",
        )

        assert len(events) == 1
        assert events[0].event == "attempt_error"
        assert events[0].data["error_type"] == "proceed"
