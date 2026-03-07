"""Tests for infra.websocket.resolve_generation_winner.

resolve_generation_winner is tested with mocked DB (conn.fetch) and
mocked search_test_grades. Tests verify: correct queries, score comparison,
and edge cases.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.websocket.resolve_generation_winner import (
    GenerationWinnerResult,
    resolve_generation_winner,
)

MODULE = "app.infra.websocket.resolve_generation_winner"


class FakeGrade:
    """Mimics GetTestGradeResponse for testing."""

    def __init__(self, invocation_id, score, passed=True):
        self.invocation_id = invocation_id
        self.score = score
        self.passed = passed


def _mock_conn(invocation_rows=None, agent_rows=None):
    """Create a mock conn that returns different results per fetch call."""
    conn = AsyncMock()
    call_count = {"n": 0}

    async def fetch_side_effect(query, *args):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return invocation_rows or []
        elif call_count["n"] == 2:
            return agent_rows or []
        return []

    conn.fetch = AsyncMock(side_effect=fetch_side_effect)
    return conn


# ═══════════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveGenerationWinnerEmpty:
    async def test_no_invocations_returns_none(self):
        conn = _mock_conn(invocation_rows=[])

        result = await resolve_generation_winner(conn, test_id=uuid4())

        assert result is None

    async def test_no_grades_returns_none(self):
        inv_id = uuid4()
        agent_id = uuid4()

        conn = _mock_conn(
            invocation_rows=[{"id": inv_id}],
            agent_rows=[{"test_invocation_id": inv_id, "agents_id": agent_id}],
        )

        with patch(
            f"{MODULE}.search_test_grades",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await resolve_generation_winner(conn, test_id=uuid4())

        assert result is None


@pytest.mark.asyncio
class TestResolveGenerationWinnerScoring:
    async def test_single_agent_wins_by_default(self):
        inv_id = uuid4()
        agent_id = uuid4()
        test_id = uuid4()

        conn = _mock_conn(
            invocation_rows=[{"id": inv_id}],
            agent_rows=[{"test_invocation_id": inv_id, "agents_id": agent_id}],
        )

        grade = FakeGrade(invocation_id=inv_id, score=85)

        with patch(
            f"{MODULE}.search_test_grades",
            new_callable=AsyncMock,
            return_value=[grade],
        ):
            result = await resolve_generation_winner(conn, test_id=test_id)

        assert isinstance(result, GenerationWinnerResult)
        assert result.winning_agent_id == agent_id
        assert result.winning_score == 85
        assert len(result.all_results) == 1

    async def test_highest_score_wins(self):
        inv_id_1 = uuid4()
        inv_id_2 = uuid4()
        agent_id_1 = uuid4()
        agent_id_2 = uuid4()
        test_id = uuid4()

        conn = _mock_conn(
            invocation_rows=[{"id": inv_id_1}, {"id": inv_id_2}],
            agent_rows=[
                {"test_invocation_id": inv_id_1, "agents_id": agent_id_1},
                {"test_invocation_id": inv_id_2, "agents_id": agent_id_2},
            ],
        )

        grades = [
            FakeGrade(invocation_id=inv_id_1, score=70),
            FakeGrade(invocation_id=inv_id_2, score=95),
        ]

        with patch(
            f"{MODULE}.search_test_grades",
            new_callable=AsyncMock,
            return_value=grades,
        ):
            result = await resolve_generation_winner(conn, test_id=test_id)

        assert result.winning_agent_id == agent_id_2
        assert result.winning_score == 95
        assert result.winning_invocation_id == inv_id_2
        assert len(result.all_results) == 2

    async def test_three_agents_middle_wins(self):
        inv_ids = [uuid4() for _ in range(3)]
        agent_ids = [uuid4() for _ in range(3)]
        test_id = uuid4()

        conn = _mock_conn(
            invocation_rows=[{"id": iid} for iid in inv_ids],
            agent_rows=[
                {"test_invocation_id": inv_ids[i], "agents_id": agent_ids[i]}
                for i in range(3)
            ],
        )

        grades = [
            FakeGrade(invocation_id=inv_ids[0], score=50),
            FakeGrade(invocation_id=inv_ids[1], score=100),
            FakeGrade(invocation_id=inv_ids[2], score=75),
        ]

        with patch(
            f"{MODULE}.search_test_grades",
            new_callable=AsyncMock,
            return_value=grades,
        ):
            result = await resolve_generation_winner(conn, test_id=test_id)

        assert result.winning_agent_id == agent_ids[1]
        assert result.winning_score == 100

    async def test_tie_first_graded_wins(self):
        """Equal scores — first in grades list wins (max picks first)."""
        inv_id_1 = uuid4()
        inv_id_2 = uuid4()
        agent_id_1 = uuid4()
        agent_id_2 = uuid4()

        conn = _mock_conn(
            invocation_rows=[{"id": inv_id_1}, {"id": inv_id_2}],
            agent_rows=[
                {"test_invocation_id": inv_id_1, "agents_id": agent_id_1},
                {"test_invocation_id": inv_id_2, "agents_id": agent_id_2},
            ],
        )

        grades = [
            FakeGrade(invocation_id=inv_id_1, score=80),
            FakeGrade(invocation_id=inv_id_2, score=80),
        ]

        with patch(
            f"{MODULE}.search_test_grades",
            new_callable=AsyncMock,
            return_value=grades,
        ):
            result = await resolve_generation_winner(conn, test_id=uuid4())

        # First grade in list wins on tie
        assert result.winning_agent_id == agent_id_1


@pytest.mark.asyncio
class TestResolveGenerationWinnerEdgeCases:
    async def test_grade_without_agent_mapping_skipped(self):
        """Grade for an invocation with no agent connection is ignored."""
        inv_id_1 = uuid4()
        inv_id_2 = uuid4()
        agent_id_1 = uuid4()

        conn = _mock_conn(
            invocation_rows=[{"id": inv_id_1}, {"id": inv_id_2}],
            # Only inv_id_1 has an agent mapping
            agent_rows=[
                {"test_invocation_id": inv_id_1, "agents_id": agent_id_1},
            ],
        )

        grades = [
            FakeGrade(invocation_id=inv_id_1, score=70),
            FakeGrade(invocation_id=inv_id_2, score=100),  # no agent → skipped
        ]

        with patch(
            f"{MODULE}.search_test_grades",
            new_callable=AsyncMock,
            return_value=grades,
        ):
            result = await resolve_generation_winner(conn, test_id=uuid4())

        assert result.winning_agent_id == agent_id_1
        assert result.winning_score == 70
        assert len(result.all_results) == 1

    async def test_queries_use_correct_params(self):
        """Verify the SQL queries receive correct test_id and invocation_ids."""
        test_id = uuid4()
        inv_id = uuid4()
        agent_id = uuid4()

        conn = _mock_conn(
            invocation_rows=[{"id": inv_id}],
            agent_rows=[{"test_invocation_id": inv_id, "agents_id": agent_id}],
        )

        with patch(
            f"{MODULE}.search_test_grades",
            new_callable=AsyncMock,
            return_value=[FakeGrade(invocation_id=inv_id, score=90)],
        ) as mock_grades:
            await resolve_generation_winner(conn, test_id=test_id)

        # First fetch: invocations by test_id
        first_call = conn.fetch.call_args_list[0]
        assert first_call[0][1] == test_id  # $1 = test_id

        # Second fetch: agent mapping by invocation_ids
        second_call = conn.fetch.call_args_list[1]
        assert second_call[0][1] == [inv_id]  # $1 = invocation_ids

        # search_test_grades called with correct invocation_ids + bypass_mv
        mock_grades.assert_called_once()
        grade_kwargs = mock_grades.call_args[1]
        assert grade_kwargs["invocation_ids"] == [inv_id]
        assert grade_kwargs["bypass_mv"] is True
