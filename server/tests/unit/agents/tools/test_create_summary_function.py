"""
Tests for app.utils.agents.tools.create_summary_function
"""

import uuid
from typing import Any

from app.utils.agents.tools.create_summary_function import create_summary_function


class TestCreate_Summary_Function:
    """Tests for create_summary_function."""

    def test_create_summary_function_creates_tool(self) -> None:
        """Test that summary function creates a tool."""
        grading_results: dict[str, Any] = {}
        grading_progress: dict[str, bool] = {}

        chat_id = uuid.uuid4()

        async def mock_emit(event_data: dict[str, Any]) -> None:
            pass

        tool = create_summary_function(chat_id, mock_emit, grading_results, grading_progress)
        assert tool is not None
