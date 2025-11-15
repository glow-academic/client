"""
Tests for app.utils.agents.tools.create_guardrail_tools
"""

from app.utils.agents.tools.create_guardrail_tools import create_guardrail_tools


class TestCreate_Guardrail_Tools:
    """Tests for create_guardrail_tools."""

    def test_create_guardrail_tools_creates_tools(self) -> None:
        """Test that guardrail tools are created."""
        tools = create_guardrail_tools()
        assert len(tools) == 2  # evaluation + debug_info
