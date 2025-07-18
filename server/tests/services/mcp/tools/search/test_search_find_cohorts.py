"""
Tests for app.services.mcp.tools.search.find_cohorts
"""

import uuid
from unittest.mock import MagicMock, patch
from sqlalchemy.exc import SQLAlchemyError

from app.services.mcp.tools.search.find_cohorts import find_cohorts


class MockCohort:
    """Minimal mock for Cohorts model."""

    def __init__(self, id, title, active=True, profile_ids=None, description=None):
        self.id = id
        self.title = title
        self.active = active
        self.profile_ids = profile_ids if profile_ids is not None else []
        self.description = description


@patch("app.services.mcp.tools.search.find_cohorts.get_session")
class TestFind_Cohorts:
    """Tests for find_cohorts function."""

    def test_find_cohorts_success(self, mock_get_session):
        """Basic successful search."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_cohort = MockCohort(
            id=uuid.uuid4(),
            title="Fall 2025 Freshmen",
            profile_ids=[uuid.uuid4(), uuid.uuid4()],
            description="Incoming fall cohort",
        )
        mock_session.exec.return_value.all.return_value = [mock_cohort]

        result = find_cohorts(query="Fall 2025")

        assert len(result) == 1
        r0 = result[0]
        assert r0["id"] == str(mock_cohort.id)
        assert r0["title"] == "Fall 2025 Freshmen"
        assert r0["profile_count"] == 2
        assert "score" in r0 and isinstance(r0["score"], int)
        assert r0["score"] > 0
        mock_session.close.assert_called_once()

    def test_find_cohorts_no_results(self, mock_get_session):
        """Query yields empty result set."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.return_value.all.return_value = []

        result = find_cohorts(query="NonExistent Cohort")

        assert result == []

    def test_find_cohorts_error(self, mock_get_session):
        """Database error is wrapped and returned."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.side_effect = SQLAlchemyError("DB Error")

        result = find_cohorts(query="Any")

        assert result == [{"error": "Database error: DB Error"}]

    def test_find_cohorts_ranking(self, mock_get_session):
        """
        Ensure best match (exact title) ranks before prefix/contains hits.
        """
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        c_exact = MockCohort(uuid.uuid4(), "Spring 2025 Nursing", profile_ids=[])
        c_prefix = MockCohort(
            uuid.uuid4(), "Spring 2025 Nursing Cohort", profile_ids=[uuid.uuid4()]
        )
        c_far = MockCohort(uuid.uuid4(), "General Nursing Group", profile_ids=[])

        # Return deliberately reversed to ensure re-ranking
        mock_session.exec.return_value.all.return_value = [c_far, c_prefix, c_exact]

        result = find_cohorts(query="Spring 2025 Nursing", limit=5)

        assert len(result) == 3
        assert result[0]["title"] == "Spring 2025 Nursing"
        assert result[0]["score"] > result[1]["score"] >= result[2]["score"]
