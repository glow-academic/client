"""Tests for generate_new_impl — EmitFn pattern.

Rate limit gate with identity validation, rate limiting via
resolve_runs_context, and audio session continuation.
Uses recording_emit() to capture events.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.generate_new_impl import generate_new_impl
from app.infra.websocket.socket_event import recording_emit

_P = "app.infra.websocket.generate_new_impl"

_VALID_PROFILE = "00000000-0000-0000-0000-000000000001"


def _base_data(**overrides: object) -> dict:
    d: dict = {
        "sid": "s1",
        "profile_id": _VALID_PROFILE,
        "session_id": "sess-1",
        "artifact_types": [{"name": "agent", "operation": "get"}],
        "resource_types": [],
    }
    d.update(overrides)
    return d


@pytest.mark.asyncio
class TestGenerateNewImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await generate_new_impl({"sid": ""}, emit=emit, conn=AsyncMock())
        assert events == []

    async def test_no_profile_emits_error(self):
        emit, events = recording_emit()
        await generate_new_impl(
            _base_data(profile_id=None), emit=emit, conn=AsyncMock()
        )
        assert len(events) == 1
        assert events[0].event == "generate_error"
        assert "Profile not found" in events[0].data["error_message"]

    async def test_no_session_emits_error(self):
        emit, events = recording_emit()
        await generate_new_impl(
            _base_data(session_id=None), emit=emit, conn=AsyncMock()
        )
        assert len(events) == 1
        assert events[0].event == "generate_error"
        assert "Session not found" in events[0].data["error_message"]

    async def test_invalid_profile_id_emits_error(self):
        emit, events = recording_emit()
        await generate_new_impl(
            _base_data(profile_id="not-a-uuid"), emit=emit, conn=AsyncMock()
        )
        assert len(events) == 1
        assert events[0].event == "generate_error"
        assert "Invalid profile_id" in events[0].data["error_message"]

    async def test_normal_forwards_to_prepare(self):
        """No rate limit, no audio session → emits generate_prepare."""
        emit, events = recording_emit()
        data = _base_data()
        with patch(f"{_P}.get_session_by_group_id", return_value=None):
            await generate_new_impl(data, emit=emit, conn=AsyncMock())
        assert len(events) == 1
        assert events[0].event == "generate_prepare"
        assert events[0].data == data

    async def test_rate_limit_exceeded_emits_error(self):
        emit, events = recording_emit()
        runs_ctx = SimpleNamespace(total_count=10)
        with patch(
            f"{_P}.resolve_runs_context",
            new_callable=AsyncMock,
            return_value=runs_ctx,
        ):
            await generate_new_impl(
                _base_data(requests_per_day=5), emit=emit, conn=AsyncMock()
            )
        assert len(events) == 1
        assert events[0].event == "generate_error"
        assert "Rate limit exceeded" in events[0].data["error_message"]

    async def test_rate_limit_ok_forwards_to_prepare(self):
        emit, events = recording_emit()
        runs_ctx = SimpleNamespace(total_count=2)
        with (
            patch(
                f"{_P}.resolve_runs_context",
                new_callable=AsyncMock,
                return_value=runs_ctx,
            ),
            patch(f"{_P}.get_session_by_group_id", return_value=None),
        ):
            await generate_new_impl(
                _base_data(requests_per_day=5), emit=emit, conn=AsyncMock()
            )
        assert len(events) == 1
        assert events[0].event == "generate_prepare"

    async def test_rate_limit_audio_session_emits_error_and_complete(self):
        """Rate limit hit with active audio session → attempt_error + audio_session_complete."""
        emit, events = recording_emit()
        runs_ctx = SimpleNamespace(total_count=10)
        mock_session = SimpleNamespace(chat_id="c1")
        with (
            patch(
                f"{_P}.resolve_runs_context",
                new_callable=AsyncMock,
                return_value=runs_ctx,
            ),
            patch(f"{_P}.get_session_by_group_id", return_value=mock_session),
        ):
            await generate_new_impl(
                _base_data(requests_per_day=5, group_id="g1"),
                emit=emit,
                conn=AsyncMock(),
            )
        assert len(events) == 2
        assert events[0].event == "attempt_error"
        assert events[0].data["error_type"] == "rate_limit"
        assert events[0].data["chat_id"] == "c1"
        assert events[1].event == "generate_audio_session_complete"

    async def test_audio_continuation_rotates_run_id(self):
        """Existing audio session on group_id → rotate run_id, no events."""
        emit, events = recording_emit()
        mock_session = SimpleNamespace(chat_id="c1")
        with (
            patch(f"{_P}.get_session_by_group_id", return_value=mock_session),
            patch(f"{_P}.rotate_run_id") as mock_rotate,
        ):
            await generate_new_impl(
                _base_data(group_id="g1"), emit=emit, conn=AsyncMock()
            )
        assert events == []
        mock_rotate.assert_called_once()

    async def test_rate_limit_check_error_passes_through(self):
        """resolve_runs_context failure → pass through to generate_prepare."""
        emit, events = recording_emit()
        with (
            patch(
                f"{_P}.resolve_runs_context",
                new_callable=AsyncMock,
                side_effect=RuntimeError("db down"),
            ),
            patch(f"{_P}.get_session_by_group_id", return_value=None),
        ):
            await generate_new_impl(
                _base_data(requests_per_day=5), emit=emit, conn=AsyncMock()
            )
        assert len(events) == 1
        assert events[0].event == "generate_prepare"
