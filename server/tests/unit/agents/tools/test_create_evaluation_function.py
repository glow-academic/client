"""
Tests for app.utils.agents.tools.create_evaluation_function
"""

from app.main import guardrail_progress, guardrail_results
from utils.agents.tools.create_evaluation_function import create_evaluation_function


class TestCreate_Evaluation_Function:
    """Tests for create_evaluation_function."""

    def test_create_evaluation_function_creates_tool(self) -> None:
        """Test that evaluation function creates a tool."""
        # Clear previous results
        guardrail_results.clear()
        guardrail_progress.clear()

        tool = create_evaluation_function()
        assert tool is not None
