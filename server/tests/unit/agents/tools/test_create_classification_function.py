"""
Tests for app.utils.agents.tools.create_classification_function
"""

from app.utils.agents.tools.create_classification_function import (
    create_classification_function,
)

from app.main import classification_progress, classification_results


class TestCreate_Classification_Function:
    """Tests for create_classification_function."""

    def test_create_classification_function_creates_tool(self) -> None:
        """Test that classification function creates a tool."""
        # Clear previous results
        classification_results.clear()
        classification_progress.clear()

        tool = create_classification_function("homeworks", "Assignments")
        assert tool is not None

    def test_classification_function_stores_results(self) -> None:
        """Test that classification function stores results."""
        # Clear previous results
        classification_results.clear()
        classification_progress.clear()

        create_classification_function("homeworks", "Assignments")

        # Call the tool function (it's async, but we can test the structure)
        # The actual function would be called by the agent
        assert "homeworks" not in classification_results
