"""
Tests for app.utils.agents.tools.create_objectives_function
"""

import uuid

from app.main import scenario_progress, scenario_results
from utils.agents.tools.create_objectives_function import create_objectives_function


class TestCreate_Objectives_Function:
    """Tests for create_objectives_function."""

    def test_create_objectives_function_creates_tool(self) -> None:
        """Test that objectives function creates a tool."""
        # Clear previous results
        scenario_results.clear()
        scenario_progress.clear()

        group_id = uuid.uuid4()
        tool = create_objectives_function(group_id)
        assert tool is not None
