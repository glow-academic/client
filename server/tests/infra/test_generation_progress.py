"""Tests for generation_progress_impl — EmitFn pattern.

Tracks resource/entry completions via run_tracker and emits progress.
Uses recording_emit() to capture events — no mocks needed except trackers.
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.generation_progress_impl import generation_progress_impl
from app.infra.websocket.socket_event import recording_emit

_P = "app.infra.websocket.generation_progress_impl"


@pytest.mark.asyncio
class TestGenerationProgressImpl:
    async def test_non_tool_result_skipped(self):
        emit, events = recording_emit()
        await generation_progress_impl(
            {"event_type": "other"}, emit=emit, redis=object()
        )
        assert events == []

    async def test_no_sid_skipped(self):
        emit, events = recording_emit()
        await generation_progress_impl(
            {"event_type": "tool_result", "sid": "", "run_id": "r1"},
            emit=emit,
            redis=object(),
        )
        assert events == []

    async def test_no_run_id_skipped(self):
        emit, events = recording_emit()
        await generation_progress_impl(
            {"event_type": "tool_result", "sid": "s1"},
            emit=emit,
            redis=object(),
        )
        assert events == []

    async def test_no_resource_or_entry_id_skipped(self):
        emit, events = recording_emit()
        await generation_progress_impl(
            {"event_type": "tool_result", "sid": "s1", "run_id": "r1", "result": {}},
            emit=emit,
            redis=object(),
        )
        assert events == []

    async def test_resource_progress_emitted(self):
        emit, events = recording_emit()
        mock_redis = object()
        with (
            patch(
                f"{_P}.record_unit_soft",
                new_callable=AsyncMock,
                return_value=(2, 5),
            ) as mock_unit,
            patch(
                f"{_P}.record_resource_complete",
                new_callable=AsyncMock,
            ) as mock_legacy,
        ):
            await generation_progress_impl(
                {
                    "event_type": "tool_result",
                    "sid": "s1",
                    "run_id": "r1",
                    "artifact_type": "agent",
                    "group_id": "g1",
                    "agent_id": "a1",
                    "result": {
                        "resource_id": "res-1",
                        "resource_type": "prompts",
                    },
                },
                emit=emit,
                redis=mock_redis,
            )

        assert len(events) == 1
        e = events[0]
        assert e.event == "generation_channel"
        assert e.data["type"] == "progress"
        assert e.data["completed_resources"] == 2
        assert e.data["total_resources"] == 5
        assert e.data["percentage"] == 40
        assert e.data["last_completed_resource"] == "prompts"

        mock_unit.assert_called_once_with(
            mock_redis,
            run_id="r1",
            agent_id="a1",
            target_type="resource",
            target_name="prompts",
            result_id="res-1",
        )
        mock_legacy.assert_called_once_with("r1", "prompts")

    async def test_entry_progress_emitted(self):
        emit, events = recording_emit()
        with (
            patch(
                f"{_P}.record_unit_soft",
                new_callable=AsyncMock,
                return_value=(1, 3),
            ),
            patch(f"{_P}.record_resource_complete", new_callable=AsyncMock) as mock_legacy,
        ):
            await generation_progress_impl(
                {
                    "event_type": "tool_result",
                    "sid": "s1",
                    "run_id": "r1",
                    "artifact_type": "agent",
                    "group_id": "g1",
                    "result": {
                        "entry_id": "ent-1",
                        "entry_type": "contents",
                    },
                },
                emit=emit,
                redis=object(),
            )

        assert len(events) == 1
        assert events[0].data["percentage"] == 33
        assert events[0].data["last_completed_resource"] == "contents"
        # Legacy tracker not called for entries
        mock_legacy.assert_not_called()

    async def test_agent_id_defaults_to_unknown(self):
        emit, events = recording_emit()
        with (
            patch(
                f"{_P}.record_unit_soft",
                new_callable=AsyncMock,
                return_value=(1, 1),
            ) as mock_unit,
            patch(f"{_P}.record_resource_complete", new_callable=AsyncMock),
        ):
            await generation_progress_impl(
                {
                    "event_type": "tool_result",
                    "sid": "s1",
                    "run_id": "r1",
                    "result": {"resource_id": "res-1", "resource_type": "names"},
                },
                emit=emit,
                redis=object(),
            )

        assert mock_unit.call_args.kwargs["agent_id"] == "unknown"

    async def test_tracker_error_falls_back_to_1_1(self):
        emit, events = recording_emit()
        with (
            patch(
                f"{_P}.record_unit_soft",
                new_callable=AsyncMock,
                side_effect=RuntimeError("redis down"),
            ),
            patch(f"{_P}.record_resource_complete", new_callable=AsyncMock),
        ):
            await generation_progress_impl(
                {
                    "event_type": "tool_result",
                    "sid": "s1",
                    "run_id": "r1",
                    "result": {"resource_id": "res-1", "resource_type": "names"},
                },
                emit=emit,
                redis=object(),
            )

        assert len(events) == 1
        assert events[0].data["completed_resources"] == 1
        assert events[0].data["total_resources"] == 1
        assert events[0].data["percentage"] == 100

    async def test_percentage_capped_at_100(self):
        emit, events = recording_emit()
        with (
            patch(
                f"{_P}.record_unit_soft",
                new_callable=AsyncMock,
                return_value=(6, 5),  # over-count
            ),
            patch(f"{_P}.record_resource_complete", new_callable=AsyncMock),
        ):
            await generation_progress_impl(
                {
                    "event_type": "tool_result",
                    "sid": "s1",
                    "run_id": "r1",
                    "result": {"resource_id": "res-1", "resource_type": "names"},
                },
                emit=emit,
                redis=object(),
            )

        assert events[0].data["percentage"] == 100
