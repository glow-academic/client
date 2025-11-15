"""
Tests for app.utils.agents.tools.create_classification_tools
"""

import pytest
from app.utils.agents.tools.create_classification_tools import create_classification_tools


class TestCreate_Classification_Tools:
    """Tests for create_classification_tools."""

    def test_create_classification_tools_creates_all_categories(self) -> None:
        """Test that all classification tools are created."""
        tools = create_classification_tools()
        assert len(tools) == 7  # 7 categories

