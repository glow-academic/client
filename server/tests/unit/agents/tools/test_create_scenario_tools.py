"""
Tests for app.utils.agents.tools.create_scenario_tools
"""

import uuid

import pytest
from app.utils.agents.tools.create_scenario_tools import create_scenario_tools


class TestCreate_Scenario_Tools:
    """Tests for create_scenario_tools."""

    def test_create_scenario_tools_with_objectives(self) -> None:
        """Test creating scenario tools with objectives enabled."""
        group_id = uuid.uuid4()
        tools = create_scenario_tools(group_id, objectives_enabled=True)
        assert len(tools) == 2  # title_description + objectives

    def test_create_scenario_tools_without_objectives(self) -> None:
        """Test creating scenario tools without objectives."""
        group_id = uuid.uuid4()
        tools = create_scenario_tools(group_id, objectives_enabled=False)
        assert len(tools) == 1  # title_description only

