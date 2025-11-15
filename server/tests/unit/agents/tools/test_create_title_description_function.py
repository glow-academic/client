"""
Tests for app.utils.agents.tools.create_title_description_function
"""

import uuid

import pytest
from app.main import scenario_progress, scenario_results
from app.utils.agents.tools.create_title_description_function import (
    create_title_description_function,
)


class TestCreate_Title_Description_Function:
    """Tests for create_title_description_function."""

    def test_create_title_description_function_creates_tool(self) -> None:
        """Test that title description function creates a tool."""
        # Clear previous results
        scenario_results.clear()
        scenario_progress.clear()

        group_id = uuid.uuid4()
        tool = create_title_description_function(group_id)
        assert tool is not None
