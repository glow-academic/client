"""
Tests for app.utils.agents.tools.create_evaluation_function
"""

from typing import Any

from app.utils.agents.tools.create_evaluation_function import create_evaluation_function


class TestCreate_Evaluation_Function:
    """Tests for create_evaluation_function."""

    def test_create_evaluation_function_creates_tool(self) -> None:
        """Test that evaluation function creates a tool."""
        guardrail_results: dict[str, Any] = {}
        guardrail_progress: dict[str, bool] = {}

        tool = create_evaluation_function(guardrail_results, guardrail_progress)
        assert tool is not None
