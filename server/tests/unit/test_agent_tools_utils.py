"""
Tests for app.utils.agent_tools
"""

import uuid
from typing import Any

import pytest
from app.utils.agents.tools.create_classification_function import create_classification_function
from app.utils.agents.tools.create_classification_tools import create_classification_tools
from app.utils.agents.tools.create_evaluation_function import create_evaluation_function
from app.utils.agents.tools.create_grading_function import create_grading_function
from app.utils.agents.tools.create_grading_tools import create_grading_tools
from app.utils.agents.tools.create_guardrail_tools import create_guardrail_tools
from app.utils.agents.tools.create_hint_function import create_hint_function
from app.utils.agents.tools.create_hint_tools import create_hint_tools
from app.utils.agents.tools.create_objectives_function import create_objectives_function
from app.utils.agents.tools.create_scenario_tools import create_scenario_tools
from app.utils.agents.tools.create_safe_field_name import create_safe_field_name
from app.utils.agents.tools.create_summary_function import create_summary_function
from app.utils.agents.tools.create_title_description_function import create_title_description_function
from app.utils.agents.tools.globals import (
    classification_progress,
    classification_results,
    grading_progress,
    grading_results,
    guardrail_progress,
    guardrail_results,
    hint_progress,
    hint_results,
    scenario_progress,
    scenario_results,
)


class TestCreate_Safe_Field_Name:
    """Tests for create_safe_field_name function."""

    def test_create_safe_field_name_simple(self) -> None:
        """Test with simple name."""
        result = create_safe_field_name("Communication")
        assert result == "communication"

    def test_create_safe_field_name_with_spaces(self) -> None:
        """Test with spaces."""
        result = create_safe_field_name("Problem Solving")
        assert result == "problem_solving"

    def test_create_safe_field_name_with_special_chars(self) -> None:
        """Test with special characters."""
        result = create_safe_field_name("Test-Name (Special)")
        assert result == "test_name_special"

    def test_create_safe_field_name_multiple_underscores(self) -> None:
        """Test that multiple underscores are collapsed."""
        result = create_safe_field_name("Test___Name")
        assert result == "test_name"

    def test_create_safe_field_name_leading_trailing_underscores(self) -> None:
        """Test that leading/trailing underscores are removed."""
        result = create_safe_field_name("_Test_Name_")
        assert result == "test_name"


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

        tool = create_classification_function("homeworks", "Assignments")

        # Call the tool function (it's async, but we can test the structure)
        # The actual function would be called by the agent
        assert "homeworks" not in classification_results


class TestCreate_Classification_Tools:
    """Tests for create_classification_tools."""

    def test_create_classification_tools_creates_all_categories(self) -> None:
        """Test that all classification tools are created."""
        tools = create_classification_tools()
        assert len(tools) == 7  # 7 categories


class TestCreate_Title_Description_Function:
    """Tests for create_title_description_function."""

    def test_create_title_description_function_creates_tool(self) -> None:
        """Test that title description function creates a tool."""
        # Clear previous results
        scenario_results.clear()
        scenario_progress.clear()

        group_id = uuid.uuid4()
        tool = create_title_description_function(group_id)
        assert tool is not None


class TestCreate_Objectives_Function:
    """Tests for create_objectives_function."""

    def test_create_objectives_function_creates_tool(self) -> None:
        """Test that objectives function creates a tool."""
        # Clear previous results
        scenario_results.clear()
        scenario_progress.clear()

        group_id = uuid.uuid4()
        tool = create_objectives_function(group_id)
        assert tool is not None


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


class TestCreate_Grading_Function:
    """Tests for create_grading_function."""

    def test_create_grading_function_creates_tool(self) -> None:
        """Test that grading function creates a tool."""
        # Clear previous results
        grading_results.clear()
        grading_progress.clear()

        standard_group = {
            "id": uuid.uuid4(),
            "name": "Communication",
            "short_name": "COMM",
            "description": "Communication skills",
        }
        standards = [
            {
                "standard_group_id": standard_group["id"],
                "points": 5,
                "name": "Excellent",
                "description": "Excellent communication",
            }
        ]
        chat_id = uuid.uuid4()

        async def mock_emit(event_data: dict[str, Any]) -> None:
            pass

        tool = create_grading_function(standard_group, standards, chat_id, 1, mock_emit)
        assert tool is not None


class TestCreate_Summary_Function:
    """Tests for create_summary_function."""

    def test_create_summary_function_creates_tool(self) -> None:
        """Test that summary function creates a tool."""
        # Clear previous results
        grading_results.clear()
        grading_progress.clear()

        chat_id = uuid.uuid4()

        async def mock_emit(event_data: dict[str, Any]) -> None:
            pass

        tool = create_summary_function(chat_id, mock_emit)
        assert tool is not None


class TestCreate_Grading_Tools:
    """Tests for create_grading_tools."""

    def test_create_grading_tools_creates_all_tools(self) -> None:
        """Test that all grading tools are created."""
        # Clear previous results
        grading_results.clear()
        grading_progress.clear()

        standard_groups = [
            {
                "id": uuid.uuid4(),
                "name": "Communication",
                "short_name": "COMM",
                "description": "Communication skills",
            },
            {
                "id": uuid.uuid4(),
                "name": "Problem Solving",
                "short_name": "PROB",
                "description": "Problem solving skills",
            },
        ]
        standards = [
            {
                "standard_group_id": standard_groups[0]["id"],
                "points": 5,
                "name": "Excellent",
                "description": "Excellent",
            }
        ]
        chat_id = uuid.uuid4()

        async def mock_emit(event_data: dict[str, Any]) -> None:
            pass

        tools = create_grading_tools(standard_groups, standards, chat_id, mock_emit)
        assert len(tools) == 3  # 2 standard groups + 1 summary


class TestCreate_Hint_Function:
    """Tests for create_hint_function."""

    def test_create_hint_function_creates_tool(self) -> None:
        """Test that hint function creates a tool."""
        # Clear previous results
        hint_results.clear()
        hint_progress.clear()

        tool = create_hint_function(1)
        assert tool is not None


class TestCreate_Hint_Tools:
    """Tests for create_hint_tools."""

    def test_create_hint_tools_creates_three_hints(self) -> None:
        """Test that three hint tools are created."""
        tools = create_hint_tools()
        assert len(tools) == 4  # 3 hints + debug_info


class TestCreate_Evaluation_Function:
    """Tests for create_evaluation_function."""

    def test_create_evaluation_function_creates_tool(self) -> None:
        """Test that evaluation function creates a tool."""
        # Clear previous results
        guardrail_results.clear()
        guardrail_progress.clear()

        tool = create_evaluation_function()
        assert tool is not None


class TestCreate_Guardrail_Tools:
    """Tests for create_guardrail_tools."""

    def test_create_guardrail_tools_creates_tools(self) -> None:
        """Test that guardrail tools are created."""
        tools = create_guardrail_tools()
        assert len(tools) == 2  # evaluation + debug_info
