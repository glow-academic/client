"""Tests for generation_ended_impl — EmitFn pattern.

Uses recording_emit() to capture events. Mocks I/O boundaries
(DB, Redis, run_tracker) so tests run without infrastructure.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from unittest.mock import AsyncMock, patch

import pytest

from app.infra.websocket.run_tracker import UnitState
from app.infra.websocket.socket_event import recording_emit


def _import_impl():
    """Import generation_ended_impl without triggering full socket tree."""
    import importlib

    mod = importlib.import_module(
        "app.routes.v5.socket.internal.generation_ended"
    )
    return mod.generation_ended_impl


# ═══════════════════════════════════════════════════════════════════════════
# Fixtures
# ═══════════════════════════════════════════════════════════════════════════

WINNER_AGENT = str(uuid.uuid4())
LOSER_AGENT = str(uuid.uuid4())
TEST_ID = str(uuid.uuid4())
RUN_ID = str(uuid.uuid4())
INVOCATION_ID = uuid.uuid4()


@dataclass(frozen=True)
class FakeWinner:
    winning_agent_id: uuid.UUID
    winning_invocation_id: uuid.UUID
    winning_score: int
    all_results: list = field(default_factory=list)


def _make_resolution_ctx(
    *,
    sid: str = "sid-1",
    artifact_type: str = "agent",
    group_id: str = "g1",
    resource_actions: dict | None = None,
) -> dict:
    return {
        "sid": sid,
        "artifact_type": artifact_type,
        "group_id": group_id,
        "resource_actions": resource_actions or {"names": "created"},
    }


def _make_redis(ctx: dict | None = None) -> AsyncMock:
    """Create a fake Redis that returns resolution context."""
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
        await generation_ended_impl({}, emit=emit)
        assert events == []

    async def test_no_winner_emits_nothing(self):
        """resolve_generation_winner returns None → no events."""
        emit, events = recording_emit()
        redis = _make_redis()

        with (
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_redis_client",
                return_value=redis,
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_db_connection",
            ) as mock_db,
            patch(
                "app.routes.v5.socket.internal.generation_ended.resolve_generation_winner",
                return_value=None,
            ),
        ):
            mock_conn = AsyncMock()
            mock_db.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
            mock_db.return_value.__aexit__ = AsyncMock(return_value=False)

            await generation_ended_impl(
                {"test_id": TEST_ID, "run_id": RUN_ID},
                emit=emit,
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

        # Two units: winner and loser, both targeting "names" resource
        units = {
            f"{WINNER_AGENT}:resource:names": UnitState(
                state="soft", result_id=str(uuid.uuid4())
            ),
            f"{LOSER_AGENT}:resource:names": UnitState(
                state="soft", result_id=str(uuid.uuid4())
            ),
        }

        with (
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_redis_client",
                return_value=redis,
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_db_connection",
            ) as mock_db,
            patch(
                "app.routes.v5.socket.internal.generation_ended.resolve_generation_winner",
                return_value=winner,
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_all_units",
                return_value=units,
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.promote_unit",
            ) as mock_promote,
            patch(
                "app.routes.v5.socket.internal.generation_ended.fail_unit",
            ) as mock_fail,
            patch(
                "app.routes.v5.socket.internal.generation_ended.activate_rows",
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.cleanup_run",
            ),
        ):
            mock_conn = AsyncMock()
            mock_db.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
            mock_db.return_value.__aexit__ = AsyncMock(return_value=False)

            await generation_ended_impl(
                {"test_id": TEST_ID, "run_id": RUN_ID},
                emit=emit,
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

    async def test_no_run_id_emits_nothing(self):
        """No run_id in data and no fallback → early return."""
        emit, events = recording_emit()
        redis = _make_redis()

        winner = FakeWinner(
            winning_agent_id=uuid.UUID(WINNER_AGENT),
            winning_invocation_id=INVOCATION_ID,
            winning_score=80,
            all_results=[],  # empty → no fallback lookup
        )

        with (
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_redis_client",
                return_value=redis,
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_db_connection",
            ) as mock_db,
            patch(
                "app.routes.v5.socket.internal.generation_ended.resolve_generation_winner",
                return_value=winner,
            ),
        ):
            mock_conn = AsyncMock()
            mock_db.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
            mock_db.return_value.__aexit__ = AsyncMock(return_value=False)

            await generation_ended_impl(
                {"test_id": TEST_ID},  # no run_id
                emit=emit,
            )

        assert events == []

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

        # Malformed key (only 2 parts) + valid key
        units = {
            "bad:key": UnitState(state="soft"),
            f"{WINNER_AGENT}:resource:names": UnitState(state="soft", result_id=None),
        }

        with (
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_redis_client",
                return_value=redis,
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_db_connection",
            ) as mock_db,
            patch(
                "app.routes.v5.socket.internal.generation_ended.resolve_generation_winner",
                return_value=winner,
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.get_all_units",
                return_value=units,
            ),
            patch(
                "app.routes.v5.socket.internal.generation_ended.promote_unit",
            ) as mock_promote,
            patch(
                "app.routes.v5.socket.internal.generation_ended.cleanup_run",
            ),
        ):
            mock_conn = AsyncMock()
            mock_db.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
            mock_db.return_value.__aexit__ = AsyncMock(return_value=False)

            await generation_ended_impl(
                {"test_id": TEST_ID, "run_id": RUN_ID},
                emit=emit,
            )

        # Still emits complete (skips malformed, processes valid)
        assert len(events) == 1
        assert events[0].data["type"] == "complete"
        # Only the valid unit was promoted
        mock_promote.assert_called_once()
