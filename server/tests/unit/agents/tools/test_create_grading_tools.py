"""
Tests for app.utils.agents.tools.create_grading_tools
"""

import uuid
from typing import Any

from app.utils.agents.tools.create_grading_tools import create_grading_tools


class TestCreate_Grading_Tools:
    """Tests for create_grading_tools."""

    def test_create_grading_tools_creates_all_tools(self) -> None:
        """Test that all grading tools are created."""
        grading_results: dict[str, Any] = {}
        grading_progress: dict[str, bool] = {}

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

        tools = create_grading_tools(
            standard_groups, standards, chat_id, mock_emit,
            grading_results, grading_progress,
        )
        assert len(tools) == 3  # 2 standard groups + 1 summary
