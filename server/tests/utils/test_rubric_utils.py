"""
Tests for app.utils.rubric
"""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from app.utils.rubric import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest


class TestGet_Dynamic_Rubric:
    """Tests for get_dynamic_rubric function."""

    def test_get_dynamic_rubric_success(self):
        """Test successful get_dynamic_rubric execution."""
        from uuid import uuid4

        from app.models import Rubrics, StandardGroups, Standards
        from app.utils.rubric import get_dynamic_rubric

        # Create mock rubric
        rubric_id = uuid4()
        group_id = uuid4()
        rubric = Rubrics(
            id=rubric_id,
            name="Test Rubric",
            description="A test rubric",
            points=100,
            pass_points=70
        )
        
        # Create mock standard group
        standard_group = StandardGroups(
            id=group_id,
            rubric_id=rubric_id,
            name="Communication",
            short_name="COMM",
            description="Communication skills",
            points=50,
            pass_points=35
        )
        
        # Create mock standards
        standard1 = Standards(
            id=uuid4(),
            standard_group_id=group_id,
            name="Excellent",
            description="Outstanding communication",
            points=5
        )
        standard2 = Standards(
            id=uuid4(),
            standard_group_id=group_id,
            name="Good",
            description="Good communication",
            points=4
        )
        
        result = get_dynamic_rubric(rubric, [standard_group], [standard1, standard2])
        
        assert result["role"] == "system"
        assert "You are evaluating a conversation based on the following rubric" in result["content"]
        assert "RUBRIC: Test Rubric" in result["content"]
        assert "Description: A test rubric" in result["content"]
        assert "Total Points: 100" in result["content"]
        assert "Pass Points: 70" in result["content"]
        assert "CRITERION: Communication (COMM)" in result["content"]
        assert "Points: 50 (Pass: 35)" in result["content"]
        assert "5 - Excellent: Outstanding communication" in result["content"]
        assert "4 - Good: Good communication" in result["content"]

    def test_get_dynamic_rubric_error(self):
        """Test get_dynamic_rubric error handling."""
        from uuid import uuid4

        from app.models import Rubrics, StandardGroups, Standards
        from app.utils.rubric import get_dynamic_rubric

        # Test with empty standards
        rubric_id = uuid4()
        group_id = uuid4()
        rubric = Rubrics(
            id=rubric_id,
            name="Test Rubric",
            description="A test rubric",
            points=100,
            pass_points=70
        )
        
        standard_group = StandardGroups(
            id=group_id,
            rubric_id=rubric_id,
            name="Communication",
            short_name="COMM",
            description="Communication skills",
            points=50,
            pass_points=35
        )
        
        # Test with no standards
        result = get_dynamic_rubric(rubric, [standard_group], [])
        
        assert result["role"] == "system"
        assert "CRITERION: Communication (COMM)" in result["content"]
        # Should still have the criterion but no rating scale items

