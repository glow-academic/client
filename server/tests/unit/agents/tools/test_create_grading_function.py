"""
Tests for app.utils.agents.tools.create_grading_function
"""

import uuid
from typing import Any

import pytest
from app.main import grading_progress, grading_results
from app.utils.agents.tools.create_grading_function import create_grading_function


class TestCreate_Grading_Function:
    """Tests for create_grading_function."""

    def test_create_grading_function_creates_tool(self) -> None:
        """Test that grading function creates a tool."""
        # Clear previous results
        grading_results.clear()
        grading_progress.clear()

        standard_group = {
            "id": uuid.uuid4(),
            "name": "Communication",
            "short_name": "COMM",
            "description": "Communication skills",
        }
        standards = [
            {
                "standard_group_id": standard_group["id"],
                "points": 5,
                "name": "Excellent",
                "description": "Excellent communication",
            }
        ]
        chat_id = uuid.uuid4()

        async def mock_emit(event_data: dict[str, Any]) -> None:
            pass

        tool = create_grading_function(standard_group, standards, chat_id, 1, mock_emit)
        assert tool is not None
