"""
Tests for app.utils.rubric
"""

import uuid
from unittest.mock import MagicMock

import pytest
from app.utils.rubric import get_dynamic_rubric
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestGet_Dynamic_Rubric:
    """Tests for get_dynamic_rubric function."""

    def test_get_dynamic_rubric_success(self):
        """Test successful get_dynamic_rubric execution."""
        # Mock the rubric object
        mock_rubric = MagicMock()
        mock_rubric.name = "Test Rubric"
        mock_rubric.description = "A test rubric description"
        mock_rubric.points = 100
        mock_rubric.pass_points = 70

        # Mock the standard groups
        mock_group1 = MagicMock()
        mock_group1.id = uuid.uuid4()
        mock_group1.name = "Communication"
        mock_group1.short_name = "COMM"
        mock_group1.description = "Communication skills"
        mock_group1.points = 50
        mock_group1.pass_points = 35

        mock_group2 = MagicMock()
        mock_group2.id = uuid.uuid4()
        mock_group2.name = "Problem Solving"
        mock_group2.short_name = "PROB"
        mock_group2.description = "Problem solving skills"
        mock_group2.points = 50
        mock_group2.pass_points = 35

        standard_groups = [mock_group1, mock_group2]

        # Mock the standards
        mock_standard1 = MagicMock()
        mock_standard1.standard_group_id = mock_group1.id
        mock_standard1.points = 5
        mock_standard1.name = "Excellent"
        mock_standard1.description = "Excellent communication"

        mock_standard2 = MagicMock()
        mock_standard2.standard_group_id = mock_group1.id
        mock_standard2.points = 3
        mock_standard2.name = "Good"
        mock_standard2.description = "Good communication"

        standards = [mock_standard1, mock_standard2]

        result = get_dynamic_rubric(mock_rubric, standard_groups, standards)

        # Verify that the rubric was built correctly
        assert result["role"] == "system"
        assert (
            "You are evaluating a conversation based on the following rubric"
            in result["content"]
        )
        assert "Test Rubric" in result["content"]
        assert "A test rubric description" in result["content"]
        assert "Total Points: 100" in result["content"]
        assert "Pass Points: 70" in result["content"]
        assert "Communication" in result["content"]
        assert "Problem Solving" in result["content"]
        assert "Excellent" in result["content"]
        assert "Good" in result["content"]

    def test_get_dynamic_rubric_empty_standards(self):
        """Test get_dynamic_rubric with empty standards."""
        # Mock the rubric object
        mock_rubric = MagicMock()
        mock_rubric.name = "Test Rubric"
        mock_rubric.description = "A test rubric description"
        mock_rubric.points = 100
        mock_rubric.pass_points = 70

        # Mock the standard groups
        mock_group = MagicMock()
        mock_group.id = uuid.uuid4()
        mock_group.name = "Communication"
        mock_group.short_name = "COMM"
        mock_group.description = "Communication skills"
        mock_group.points = 50
        mock_group.pass_points = 35

        standard_groups = [mock_group]
        standards = []  # Empty standards

        result = get_dynamic_rubric(mock_rubric, standard_groups, standards)

        # Verify that the rubric was built correctly even with empty standards
        assert result["role"] == "system"
        assert "Test Rubric" in result["content"]
        assert "Communication" in result["content"]
        # Should not have any standard details
        assert "Excellent" not in result["content"]
        assert "Good" not in result["content"]
