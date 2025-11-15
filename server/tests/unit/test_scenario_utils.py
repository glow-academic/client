"""
Tests for app.utils.scenario
"""

import pytest


class TestFormat_Parameter_Item_Info:
    """Tests for format_parameter_item_info function."""

    def test_format_parameter_item_info_success(self) -> None:
        """Test successful format_parameter_item_info execution."""
        from app.utils.scenario import format_parameter_item_info  # type: ignore

        parameter_items = [
            {
                "item_name": "Item 1",
                "item_description": "Description 1",
                "param_name": "Parameter 1",
                "param_description": "Param Description 1",
            },
            {
                "item_name": "Item 2",
                "item_description": "Description 2",
                "param_name": "Parameter 2",
                "param_description": "Param Description 2",
            },
        ]

        result = format_parameter_item_info(parameter_items)

        assert result["role"] == "user"
        assert "The following is the parameter item information:" in result["content"]
        assert "Item 1" in result["content"]
        assert "Item 2" in result["content"]
        assert "Parameter 1" in result["content"]
        assert "Parameter 2" in result["content"]

    def test_format_parameter_item_info_empty(self) -> None:
        """Test format_parameter_item_info with empty list."""
        from app.utils.scenario import format_parameter_item_info  # type: ignore

        result = format_parameter_item_info([])

        assert result["role"] == "user"
        assert result["content"] == "No parameter items found."

    def test_format_parameter_item_info_missing_descriptions(self) -> None:
        """Test format_parameter_item_info with missing descriptions."""
        from app.utils.scenario import format_parameter_item_info  # type: ignore

        parameter_items = [{"item_name": "Item 1", "param_name": "Parameter 1"}]

        result = format_parameter_item_info(parameter_items)

        assert result["role"] == "user"
        assert "Item 1" in result["content"]
        assert "Parameter 1" in result["content"]
