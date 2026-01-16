"""
Tests for app.utils.agents.tools.create_hint_function
"""

from app.utils.agents.tools.create_hint_function import create_hint_function

from app.main import hint_progress, hint_results


class TestCreate_Hint_Function:
    """Tests for create_hint_function."""

    def test_create_hint_function_creates_tool(self) -> None:
        """Test that hint function creates a tool."""
        # Clear previous results
        hint_results.clear()
        hint_progress.clear()

        tool = create_hint_function(1)
        assert tool is not None
