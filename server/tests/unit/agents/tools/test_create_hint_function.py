"""
Tests for app.utils.agents.tools.create_hint_function
"""

from typing import Any

from app.utils.agents.tools.create_hint_function import create_hint_function


class TestCreate_Hint_Function:
    """Tests for create_hint_function."""

    def test_create_hint_function_creates_tool(self) -> None:
        """Test that hint function creates a tool."""
        hint_results: dict[str, Any] = {}
        hint_progress: dict[str, bool] = {}

        tool = create_hint_function(1, hint_results, hint_progress)
        assert tool is not None
