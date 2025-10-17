"""
Tests for app.mcp.tools.search.find_scenarios
"""

import uuid
from unittest.mock import MagicMock, patch

from app.mcp.tools.search.find_scenarios import find_scenarios
from sqlalchemy.exc import SQLAlchemyError


class MockScenario:
    """Minimal stub for Scenarios."""

    def __init__(
        self,
        id,
        name,
        description=None,
        persona_id=None,
        default_scenario=False,
        practice_scenario=False,
    ):
        self.id = id
        self.name = name
        self.description = description
        self.persona_id = persona_id
        self.default_scenario = default_scenario
        self.practice_scenario = practice_scenario


@patch("app.mcp.tools.search.find_scenarios.get_session")
class TestFind_Scenarios:
    """Tests for find_scenarios function."""

    def test_find_scenarios_success(self, mock_get_session):
        """Smoke test: returns expected fields for a match."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        mock_scenario = MockScenario(
            id=uuid.uuid4(),
            name="Medication Error in ICU",
            description="ICU patient given incorrect dosage.",
            default_scenario=True,
            practice_scenario=False,
        )
        mock_session.exec.return_value.all.return_value = [mock_scenario]

        result = find_scenarios(query="Medication Error")

        assert len(result) == 1
        r0 = result[0]
        assert r0["id"] == str(mock_scenario.id)
        assert r0["name"] == "Medication Error in ICU"
        assert r0["default_scenario"] is True
        assert r0["practice_scenario"] is False
        assert "score" in r0 and isinstance(r0["score"], int) and r0["score"] > 0
        mock_session.close.assert_called_once()

    def test_find_scenarios_no_results(self, mock_get_session):
        """Empty result set."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.return_value.all.return_value = []

        result = find_scenarios(query="NoSuchScenario")

        assert result == []

    def test_find_scenarios_error(self, mock_get_session):
        """Database error is surfaced in error list."""
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])
        mock_session.exec.side_effect = SQLAlchemyError("DB Error")

        result = find_scenarios(query="Anything")

        assert result == [{"error": "Database error: DB Error"}]

    def test_find_scenarios_ranking(self, mock_get_session):
        """
        Ensure best match > prefix > unrelated.
        """
        mock_session = MagicMock()
        mock_get_session.return_value = iter([mock_session])

        s_exact = MockScenario(
            uuid.uuid4(), "Induction Homework", description="Primary CS scenario"
        )
        s_prefix = MockScenario(uuid.uuid4(), "Induction Homework with Complications")
        s_far = MockScenario(uuid.uuid4(), "Math Homework")

        # deliberately unsorted coming from DB
        mock_session.exec.return_value.all.return_value = [s_far, s_prefix, s_exact]

        result = find_scenarios(query="Induction", limit=5)

        assert len(result) == 3
        assert result[0]["name"] == "Induction Homework"  # exact wins
        assert result[0]["score"] > result[1]["score"] >= result[2]["score"]
