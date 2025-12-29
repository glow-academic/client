"""
Tests for app.utils.agents.tools.create_grading_tools
"""

import uuid
from typing import Any

from utils.agents.tools.create_grading_tools import create_grading_tools

from app.main import grading_progress, grading_results


class TestCreate_Grading_Tools:
    """Tests for create_grading_tools."""

    def test_create_grading_tools_creates_all_tools(self) -> None:
        """Test that all grading tools are created."""
        # Clear previous results
        grading_results.clear()
        grading_progress.clear()

        standard_groups = [
            {
                "id": uuid.uuid4(),
                "name": "Communication",
                "short_name": "COMM",
                "description": "Communication skills",
            },
            {
                "id": uuid.uuid4(),
                "name": "Problem Solving",
                "short_name": "PROB",
                "description": "Problem solving skills",
            },
        ]
        standards = [
            {
                "standard_group_id": standard_groups[0]["id"],
                "points": 5,
                "name": "Excellent",
                "description": "Excellent",
            }
        ]
        chat_id = uuid.uuid4()

        async def mock_emit(event_data: dict[str, Any]) -> None:
            pass

        tools = create_grading_tools(standard_groups, standards, chat_id, mock_emit)
        assert len(tools) == 3  # 2 standard groups + 1 summary
