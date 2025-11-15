"""
Tests for app.utils.agents.tools.create_hint_tools
"""

from app.utils.agents.tools.create_hint_tools import create_hint_tools


class TestCreate_Hint_Tools:
    """Tests for create_hint_tools."""

    def test_create_hint_tools_creates_three_hints(self) -> None:
        """Test that three hint tools are created."""
        tools = create_hint_tools()
        assert len(tools) == 4  # 3 hints + debug_info
