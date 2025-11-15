"""
Tests for app.utils.rubric
"""

import uuid
from typing import Any

from app.utils.rubric import get_dynamic_rubric  # type: ignore


class TestGet_Dynamic_Rubric:
    """Tests for get_dynamic_rubric function."""

    def test_get_dynamic_rubric_success(self) -> None:
        """Test successful get_dynamic_rubric execution."""
        # Create rubric dict
        group1_id = uuid.uuid4()
        group2_id = uuid.uuid4()

        rubric = {
            "name": "Test Rubric",
            "description": "A test rubric description",
            "points": 100,
            "pass_points": 70,
        }

        # Create standard groups
        standard_groups = [
            {
                "id": group1_id,
                "name": "Communication",
                "short_name": "COMM",
                "description": "Communication skills",
                "points": 50,
                "pass_points": 35,
            },
            {
                "id": group2_id,
                "name": "Problem Solving",
                "short_name": "PROB",
                "description": "Problem solving skills",
                "points": 50,
                "pass_points": 35,
            },
        ]

        # Create standards
        standards = [
            {
                "standard_group_id": group1_id,
                "points": 5,
                "name": "Excellent",
                "description": "Excellent communication",
            },
            {
                "standard_group_id": group1_id,
                "points": 3,
                "name": "Good",
                "description": "Good communication",
            },
        ]

        result = get_dynamic_rubric(rubric, standard_groups, standards)

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

    def test_get_dynamic_rubric_empty_standards(self) -> None:
        """Test get_dynamic_rubric with empty standards."""
        # Create rubric dict
        group_id = uuid.uuid4()

        rubric = {
            "name": "Test Rubric",
            "description": "A test rubric description",
            "points": 100,
            "pass_points": 70,
        }

        # Create standard groups
        standard_groups = [
            {
                "id": group_id,
                "name": "Communication",
                "short_name": "COMM",
                "description": "Communication skills",
                "points": 50,
                "pass_points": 35,
            }
        ]
        standards: list[dict[str, Any]] = []  # Empty standards

        result = get_dynamic_rubric(rubric, standard_groups, standards)

        # Verify that the rubric was built correctly even with empty standards
        assert result["role"] == "system"
        assert "Test Rubric" in result["content"]
        assert "Communication" in result["content"]
        # Should not have any standard details
        assert "Excellent" not in result["content"]
        assert "Good" not in result["content"]
