"""
Tests for app.utils.agents.tools.create_objectives_function
"""

import uuid
from typing import Any

from app.utils.agents.tools.create_objectives_function import create_objectives_function


class TestCreate_Objectives_Function:
    """Tests for create_objectives_function."""

    def test_create_objectives_function_creates_tool(self) -> None:
        """Test that objectives function creates a tool."""
        scenario_results: dict[str, Any] = {}
        scenario_progress: dict[str, bool] = {}

        group_id = uuid.uuid4()
        tool = create_objectives_function(group_id, scenario_results, scenario_progress)
        assert tool is not None
