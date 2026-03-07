"""Tests for infra.websocket.resolve_generation_winner.

resolve_generation_winner is tested with mocked black-box functions
(search_test_invocation_entries_internal, search_test_grades).
Tests verify: correct params, score comparison, and edge cases.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.websocket.resolve_generation_winner import (
    GenerationWinnerResult,
    resolve_generation_winner,
)

MODULE = "app.infra.websocket.resolve_generation_winner"


class FakeInvocation:
    """Mimics GetTestInvocationResponse for testing."""

    def __init__(self, invocation_id, agent_ids=None):
        self.invocation_id = invocation_id
        self.agent_ids = agent_ids or []


class FakeGrade:
    """Mimics GetTestGradeResponse for testing."""

    def __init__(self, invocation_id, score, passed=True):
        self.invocation_id = invocation_id
        self.score = score
        self.passed = passed


def _patch_search_invocations(invocations):
    return patch(
        f"{MODULE}.search_test_invocation_entries_internal",
        new_callable=AsyncMock,
        return_value=invocations,
    )


def _patch_search_grades(grades):
    return patch(
        f"{MODULE}.search_test_grades",
        new_callable=AsyncMock,
        return_value=grades,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Tests
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveGenerationWinnerEmpty:
    async def test_no_invocations_returns_none(self):
        with _patch_search_invocations([]):
            result = await resolve_generation_winner(None, test_id=uuid4())

        assert result is None

    async def test_no_grades_returns_none(self):
        inv_id = uuid4()
        agent_id = uuid4()

        inv = FakeInvocation(invocation_id=inv_id, agent_ids=[agent_id])

        with (
            _patch_search_invocations([inv]),
            _patch_search_grades([]),
        ):
            result = await resolve_generation_winner(None, test_id=uuid4())

        assert result is None


@pytest.mark.asyncio
class TestResolveGenerationWinnerScoring:
    async def test_single_agent_wins_by_default(self):
        inv_id = uuid4()
        agent_id = uuid4()
        test_id = uuid4()

        inv = FakeInvocation(invocation_id=inv_id, agent_ids=[agent_id])
        grade = FakeGrade(invocation_id=inv_id, score=85)

        with (
            _patch_search_invocations([inv]),
            _patch_search_grades([grade]),
        ):
            result = await resolve_generation_winner(None, test_id=test_id)

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

        invocations = [
            FakeInvocation(invocation_id=inv_id_1, agent_ids=[agent_id_1]),
            FakeInvocation(invocation_id=inv_id_2, agent_ids=[agent_id_2]),
        ]
        grades = [
            FakeGrade(invocation_id=inv_id_1, score=70),
            FakeGrade(invocation_id=inv_id_2, score=95),
        ]

        with (
            _patch_search_invocations(invocations),
            _patch_search_grades(grades),
        ):
            result = await resolve_generation_winner(None, test_id=test_id)

        assert result.winning_agent_id == agent_id_2
        assert result.winning_score == 95
        assert result.winning_invocation_id == inv_id_2
        assert len(result.all_results) == 2

    async def test_three_agents_middle_wins(self):
        inv_ids = [uuid4() for _ in range(3)]
        agent_ids = [uuid4() for _ in range(3)]
        test_id = uuid4()

        invocations = [
            FakeInvocation(invocation_id=inv_ids[i], agent_ids=[agent_ids[i]])
            for i in range(3)
        ]
        grades = [
            FakeGrade(invocation_id=inv_ids[0], score=50),
            FakeGrade(invocation_id=inv_ids[1], score=100),
            FakeGrade(invocation_id=inv_ids[2], score=75),
        ]

        with (
            _patch_search_invocations(invocations),
            _patch_search_grades(grades),
        ):
            result = await resolve_generation_winner(None, test_id=test_id)

        assert result.winning_agent_id == agent_ids[1]
        assert result.winning_score == 100

    async def test_tie_first_graded_wins(self):
        """Equal scores — first in grades list wins (max picks first)."""
        inv_id_1 = uuid4()
        inv_id_2 = uuid4()
        agent_id_1 = uuid4()
        agent_id_2 = uuid4()

        invocations = [
            FakeInvocation(invocation_id=inv_id_1, agent_ids=[agent_id_1]),
            FakeInvocation(invocation_id=inv_id_2, agent_ids=[agent_id_2]),
        ]
        grades = [
            FakeGrade(invocation_id=inv_id_1, score=80),
            FakeGrade(invocation_id=inv_id_2, score=80),
        ]

        with (
            _patch_search_invocations(invocations),
            _patch_search_grades(grades),
        ):
            result = await resolve_generation_winner(None, test_id=uuid4())

        # First grade in list wins on tie
        assert result.winning_agent_id == agent_id_1


@pytest.mark.asyncio
class TestResolveGenerationWinnerEdgeCases:
    async def test_grade_without_agent_mapping_skipped(self):
        """Grade for an invocation with no agent_ids is ignored."""
        inv_id_1 = uuid4()
        inv_id_2 = uuid4()
        agent_id_1 = uuid4()

        invocations = [
            FakeInvocation(invocation_id=inv_id_1, agent_ids=[agent_id_1]),
            FakeInvocation(invocation_id=inv_id_2, agent_ids=[]),  # no agent
        ]
        grades = [
            FakeGrade(invocation_id=inv_id_1, score=70),
            FakeGrade(invocation_id=inv_id_2, score=100),  # no agent → skipped
        ]

        with (
            _patch_search_invocations(invocations),
            _patch_search_grades(grades),
        ):
            result = await resolve_generation_winner(None, test_id=uuid4())

        assert result.winning_agent_id == agent_id_1
        assert result.winning_score == 70
        assert len(result.all_results) == 1

    async def test_correct_params_passed_to_black_boxes(self):
        """Verify search functions receive correct test_id and invocation_ids."""
        test_id = uuid4()
        inv_id = uuid4()
        agent_id = uuid4()

        inv = FakeInvocation(invocation_id=inv_id, agent_ids=[agent_id])
        grade = FakeGrade(invocation_id=inv_id, score=90)

        with (
            _patch_search_invocations([inv]) as mock_inv_search,
            _patch_search_grades([grade]) as mock_grades,
        ):
            await resolve_generation_winner(None, test_id=test_id)

        # search_test_invocation_entries_internal called with test_ids + bypass_mv
        mock_inv_search.assert_called_once()
        inv_kwargs = mock_inv_search.call_args[1]
        assert inv_kwargs["test_ids"] == [test_id]
        assert inv_kwargs["bypass_mv"] is True

        # search_test_grades called with correct invocation_ids + bypass_mv
        mock_grades.assert_called_once()
        grade_kwargs = mock_grades.call_args[1]
        assert grade_kwargs["invocation_ids"] == [inv_id]
        assert grade_kwargs["bypass_mv"] is True
