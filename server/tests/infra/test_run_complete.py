"""Tests for run_complete_impl — EmitFn pattern.

Uses recording_emit() to capture events. All I/O dependencies (conn, redis)
are injected directly — no patching of globals needed.
"""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.run_complete_impl import run_complete_impl
from app.infra.websocket.run_tracker import UnitState
from app.infra.websocket.socket_event import recording_emit

_P = "app.infra.websocket.run_complete_impl"

AGENT_A = str(uuid.uuid4())
AGENT_B = str(uuid.uuid4())
RUN_ID = str(uuid.uuid4())
SESSION_ID = str(uuid.uuid4())


def _base_data(**overrides: object) -> dict:
    """Minimal valid data dict."""
    d: dict = {
        "sid": "sid-1",
        "run_id": RUN_ID,
        "group_id": "g1",
        "artifact_type": "agent",
        "modality": "text",
        "session_id": SESSION_ID,
        "profile_id": str(uuid.uuid4()),
        "profiles_id": str(uuid.uuid4()),
        "assistant_output": "",
        "input_text_tokens": 0,
        "output_text_tokens": 0,
        "tool_results": [],
        "metadata": {},
    }
    d.update(overrides)
    return d


@pytest.mark.asyncio
class TestRunCompleteImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await run_complete_impl(
            {"sid": ""}, emit=emit, conn=AsyncMock(), redis=AsyncMock()
        )
        assert events == []

    async def test_audio_modality_emits_generate_and_returns(self):
        """Audio continuation: emits 'generate' event to re-enter pipeline."""
        emit, events = recording_emit()
        data = _base_data(modality="audio")

        await run_complete_impl(
            data, emit=emit, conn=AsyncMock(), redis=AsyncMock()
        )

        assert len(events) == 1
        assert events[0].event == "generate"
        assert events[0].data["sid"] == "sid-1"
        assert events[0].data["group_id"] == "g1"

    async def test_not_complete_emits_nothing(self):
        """record_agent_done returns not complete → early return."""
        emit, events = recording_emit()

        with patch(f"{_P}.record_agent_done", return_value=(False, [])):
            await run_complete_impl(
                _base_data(), emit=emit, conn=AsyncMock(), redis=AsyncMock()
            )

        assert events == []

    async def test_uncontested_promotes_and_emits_complete(self):
        """Single agent per target → auto-promote, emit generation_complete."""
        emit, events = recording_emit()
        result_id = str(uuid.uuid4())

        units = {
            f"{AGENT_A}:resource:names": UnitState(
                state="soft", result_id=result_id
            ),
        }
        uncontested = {
            ("resource", "names"): (AGENT_A, units[f"{AGENT_A}:resource:names"]),
        }

        with (
            patch(f"{_P}.record_agent_done", return_value=(True, [])),
            patch(f"{_P}.get_all_units", return_value=units),
            patch(f"{_P}.find_uncontested_targets", return_value=uncontested),
            patch(f"{_P}.find_contested_targets", return_value={}),
            patch(f"{_P}.promote_unit") as mock_promote,
            patch(f"{_P}.activate_rows") as mock_activate,
            patch(f"{_P}.cleanup_run"),
        ):
            await run_complete_impl(
                _base_data(), emit=emit, conn=AsyncMock(), redis=AsyncMock()
            )

        # Promoted the unit
        mock_promote.assert_called_once()
        assert mock_promote.call_args.kwargs["agent_id"] == AGENT_A
        mock_activate.assert_called_once()

        # Emitted generation_complete
        assert len(events) == 1
        e = events[0]
        assert e.event == "generation_channel"
        assert e.data["type"] == "complete"
        assert e.data["success"] is True
        assert e.data["artifact_type"] == "agent"

    async def test_contested_with_test_emits_test_proceed(self):
        """Contested targets with generation_test_id → emit test_proceed, no complete."""
        emit, events = recording_emit()
        test_id = str(uuid.uuid4())

        contested = {
            ("resource", "names"): [
                (AGENT_A, UnitState(state="soft", result_id=str(uuid.uuid4()))),
                (AGENT_B, UnitState(state="soft", result_id=str(uuid.uuid4()))),
            ],
        }

        redis = AsyncMock()

        with (
            patch(f"{_P}.record_agent_done", return_value=(True, [])),
            patch(f"{_P}.get_all_units", return_value={}),
            patch(f"{_P}.find_uncontested_targets", return_value={}),
            patch(f"{_P}.find_contested_targets", return_value=contested),
            patch(f"{_P}.cleanup_run"),
        ):
            await run_complete_impl(
                _base_data(metadata={"generation_test_id": test_id}),
                emit=emit,
                conn=AsyncMock(),
                redis=redis,
            )

        # Emitted test_proceed, NOT generation_complete
        assert len(events) == 1
        assert events[0].event == "test_proceed"
        assert events[0].data["test_id"] == test_id
        assert events[0].data["force_proceed"] is True

        # Stored resolution context in Redis, keyed by test_id
        redis.setex.assert_called_once()
        key = redis.setex.call_args[0][0]
        assert key == f"generation_resolution:{test_id}"

    async def test_chat_special_case_emits_chat_started(self):
        """Chat artifact → refreshes MVs, emits attempt_chat_started."""
        emit, events = recording_emit()
        mock_conn = AsyncMock()

        with (
            patch(f"{_P}.record_agent_done", return_value=(True, [])),
            patch(f"{_P}.get_all_units", return_value={}),
            patch(f"{_P}.find_uncontested_targets", return_value={}),
            patch(f"{_P}.find_contested_targets", return_value={}),
            patch(f"{_P}.cleanup_run"),
            patch(f"{_P}.invalidate_tags"),
        ):
            await run_complete_impl(
                _base_data(
                    artifact_type="chat",
                    metadata={
                        "attempt_id": "att-1",
                        "attempt_chat_id": "chat-1",
                    },
                ),
                emit=emit,
                conn=mock_conn,
                redis=AsyncMock(),
            )

        # Two events: generation_complete + attempt_chat_started
        assert len(events) == 2
        assert events[0].event == "generation_channel"
        assert events[0].data["type"] == "complete"
        assert events[1].event == "attempt_chat_started"
        assert events[1].data["chat_id"] == "chat-1"

        # MV refresh happened on the injected conn
        assert mock_conn.execute.call_count == 2

    async def test_no_run_id_emits_nothing(self):
        """Missing run_id (non-audio) → early return."""
        emit, events = recording_emit()
        await run_complete_impl(
            _base_data(run_id=None),
            emit=emit,
            conn=AsyncMock(),
            redis=AsyncMock(),
        )
        assert events == []
