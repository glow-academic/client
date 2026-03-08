"""Tests for generation_ended_impl — EmitFn pattern.

Uses recording_emit() to capture events. All I/O dependencies (conn, redis)
are injected directly — no patching of globals needed.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.generation_ended_impl import generation_ended_impl
from app.infra.websocket.run_tracker import UnitState
from app.infra.websocket.socket_event import recording_emit

# ═══════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════

WINNER_AGENT = str(uuid.uuid4())
LOSER_AGENT = str(uuid.uuid4())
TEST_ID = str(uuid.uuid4())
RUN_ID = str(uuid.uuid4())
INVOCATION_ID = uuid.uuid4()

# Patch target prefix for the impl module
_P = "app.infra.websocket.generation_ended_impl"


@dataclass(frozen=True)
class FakeWinner:
    winning_agent_id: uuid.UUID
    winning_invocation_id: uuid.UUID
    winning_score: int
    all_results: list = field(default_factory=list)


def _make_resolution_ctx(
    *,
    sid: str = "sid-1",
    run_id: str = RUN_ID,
    artifact_type: str = "agent",
    group_id: str = "g1",
    resource_actions: dict | None = None,
) -> dict:
    return {
        "sid": sid,
        "run_id": run_id,
        "artifact_type": artifact_type,
        "group_id": group_id,
        "resource_actions": resource_actions or {"names": "created"},
    }


def _make_redis(ctx: dict | None = None) -> AsyncMock:
    """Create a fake Redis that returns resolution context keyed by test_id."""
    redis = AsyncMock()
    if ctx is not None:
        redis.get.return_value = json.dumps(ctx)
    else:
        redis.get.return_value = None
    return redis


# ═══════════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestGenerationEndedImpl:
    async def test_no_test_id_emits_nothing(self):
        """Missing test_id → early return, no events."""
        emit, events = recording_emit()
        await generation_ended_impl({}, emit=emit, conn=AsyncMock(), redis=AsyncMock())
        assert events == []

    async def test_no_winner_emits_nothing(self):
        """resolve_generation_winner returns None → no events."""
        emit, events = recording_emit()

        with patch(f"{_P}.resolve_generation_winner", return_value=None):
            await generation_ended_impl(
                {"test_id": TEST_ID},
                emit=emit,
                conn=AsyncMock(),
                redis=_make_redis(),
            )

        assert events == []

    async def test_no_resolution_context_emits_nothing(self):
        """No resolution context in Redis → no run_id → early return."""
        emit, events = recording_emit()

        winner = FakeWinner(
            winning_agent_id=uuid.UUID(WINNER_AGENT),
            winning_invocation_id=INVOCATION_ID,
            winning_score=80,
        )

        with patch(f"{_P}.resolve_generation_winner", return_value=winner):
            await generation_ended_impl(
                {"test_id": TEST_ID},
                emit=emit,
                conn=AsyncMock(),
                redis=_make_redis(ctx=None),  # no context stored
            )

        assert events == []

    async def test_resolution_context_missing_run_id_emits_nothing(self):
        """Resolution context exists but has no run_id → early return."""
        emit, events = recording_emit()

        winner = FakeWinner(
            winning_agent_id=uuid.UUID(WINNER_AGENT),
            winning_invocation_id=INVOCATION_ID,
            winning_score=80,
        )

        ctx_without_run_id = {"sid": "sid-1", "artifact_type": "agent"}

        with patch(f"{_P}.resolve_generation_winner", return_value=winner):
            await generation_ended_impl(
                {"test_id": TEST_ID},
                emit=emit,
                conn=AsyncMock(),
                redis=_make_redis(ctx=ctx_without_run_id),
            )

        assert events == []

    async def test_emits_generation_complete(self):
        """Happy path: winner resolved → promotes, fails, emits complete."""
        emit, events = recording_emit()
        ctx = _make_resolution_ctx()
        redis = _make_redis(ctx)

        winner = FakeWinner(
            winning_agent_id=uuid.UUID(WINNER_AGENT),
            winning_invocation_id=INVOCATION_ID,
            winning_score=95,
        )

        units = {
            f"{WINNER_AGENT}:resource:names": UnitState(
                state="soft", result_id=str(uuid.uuid4())
            ),
            f"{LOSER_AGENT}:resource:names": UnitState(
                state="soft", result_id=str(uuid.uuid4())
            ),
        }

        with (
            patch(f"{_P}.resolve_generation_winner", return_value=winner),
            patch(f"{_P}.get_all_units", return_value=units),
            patch(f"{_P}.promote_unit") as mock_promote,
            patch(f"{_P}.fail_unit") as mock_fail,
            patch(f"{_P}.activate_rows"),
            patch(f"{_P}.cleanup_run"),
        ):
            await generation_ended_impl(
                {"test_id": TEST_ID},
                emit=emit,
                conn=AsyncMock(),
                redis=redis,
            )

        # Verify events
        assert len(events) == 1
        e = events[0]
        assert e.bus == "internal"
        assert e.event == "generation_channel"
        assert e.data["type"] == "complete"
        assert e.data["success"] is True
        assert e.data["artifact_type"] == "agent"
        assert e.data["run_id"] == RUN_ID
        assert e.data["resource_actions"] == {"names": "created"}

        # Verify promote/fail called correctly
        mock_promote.assert_called_once()
        assert mock_promote.call_args.kwargs["agent_id"] == WINNER_AGENT
        mock_fail.assert_called_once()
        assert mock_fail.call_args.kwargs["agent_id"] == LOSER_AGENT

        # Verify Redis lookup was by test_id
        redis.get.assert_called_once_with(f"generation_resolution:{TEST_ID}")

        # Verify cleanup deletes by test_id
        redis.delete.assert_called_once_with(f"generation_resolution:{TEST_ID}")

    async def test_malformed_unit_key_skipped(self):
        """Unit keys with wrong format are silently skipped."""
        emit, events = recording_emit()
        ctx = _make_resolution_ctx()
        redis = _make_redis(ctx)

        winner = FakeWinner(
            winning_agent_id=uuid.UUID(WINNER_AGENT),
            winning_invocation_id=INVOCATION_ID,
            winning_score=90,
        )

        units = {
            "bad:key": UnitState(state="soft"),
            f"{WINNER_AGENT}:resource:names": UnitState(state="soft", result_id=None),
        }

        with (
            patch(f"{_P}.resolve_generation_winner", return_value=winner),
            patch(f"{_P}.get_all_units", return_value=units),
            patch(f"{_P}.promote_unit") as mock_promote,
            patch(f"{_P}.cleanup_run"),
        ):
            await generation_ended_impl(
                {"test_id": TEST_ID},
                emit=emit,
                conn=AsyncMock(),
                redis=redis,
            )

        assert len(events) == 1
        assert events[0].data["type"] == "complete"
        mock_promote.assert_called_once()
