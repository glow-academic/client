"""
Tests for app.utils.agents.tools.create_title_description_function
"""

import uuid
from typing import Any

from app.utils.agents.tools.create_title_description_function import (
    create_title_description_function,
)


class TestCreate_Title_Description_Function:
    """Tests for create_title_description_function."""

    def test_create_title_description_function_creates_tool(self) -> None:
        """Test that title description function creates a tool."""
        scenario_results: dict[str, Any] = {}
        scenario_progress: dict[str, bool] = {}

        group_id = uuid.uuid4()
        tool = create_title_description_function(group_id, scenario_results, scenario_progress)
        assert tool is not None
