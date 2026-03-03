"""Unit tests for app.v5.infra.tools.render_tool_template."""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.v5.infra.tools.render_tool_template import (
    get_rendered_template_values,
    render_tool_template,
    validate_jinja_template,
)


class TestValidateJinjaTemplate:
    """Tests for validate_jinja_template function."""

    def test_validate_empty_template(self) -> None:
        """Test that empty templates are valid."""
        is_valid, error = validate_jinja_template("")
        assert is_valid is True
        assert error is None

    def test_validate_whitespace_template(self) -> None:
        """Test that whitespace-only templates are valid."""
        is_valid, error = validate_jinja_template("   ")
        assert is_valid is True
        assert error is None

    def test_validate_simple_variable(self) -> None:
        """Test that simple variable templates are valid."""
        is_valid, error = validate_jinja_template("{{ name }}")
        assert is_valid is True
        assert error is None

    def test_validate_complex_template(self) -> None:
        """Test that complex templates are valid."""
        template = "{{ name }} - {{ age }} years old"
        is_valid, error = validate_jinja_template(template)
        assert is_valid is True
        assert error is None

    def test_validate_template_with_filter(self) -> None:
        """Test that templates with filters are valid."""
        template = "{{ name|upper }}"
        is_valid, error = validate_jinja_template(template)
        assert is_valid is True
        assert error is None

    def test_validate_invalid_syntax(self) -> None:
        """Test that invalid syntax is caught."""
        template = "{{ name }"  # Missing closing brace
        is_valid, error = validate_jinja_template(template)
        assert is_valid is False
        assert error is not None
        assert "syntax error" in error.lower() or "error" in error.lower()

    def test_validate_invalid_expression(self) -> None:
        """Test that invalid expressions are caught."""
        template = "{{ name. }}"
        is_valid, error = validate_jinja_template(template)
        assert is_valid is False
        assert error is not None


class TestRenderToolTemplate:
    """Tests for render_tool_template function."""

    @pytest.mark.asyncio
    async def test_render_template_no_output_fields(self) -> None:
        """Test rendering when tool has no output schema fields."""
        conn = AsyncMock()
        tool_id = uuid.uuid4()
        tool_arguments = {"name": "test"}

        with patch(
            "app.v5.infra.tools.render_tool_template.execute_sql_typed",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await render_tool_template(conn, tool_id, tool_arguments)

        assert result == {}

    @pytest.mark.asyncio
    async def test_render_template_simple_mapping(self) -> None:
        """Test rendering a simple template mapping."""
        conn = AsyncMock()
        tool_id = uuid.uuid4()
        tool_arguments = {"name": "John Doe"}

        mock_row = MagicMock()
        mock_row.name = "name"
        mock_row.field_type = "string"
        mock_row.template = "{{ name }}"

        with patch(
            "app.v5.infra.tools.render_tool_template.execute_sql_typed",
            new_callable=AsyncMock,
            return_value=[mock_row],
        ):
            result = await render_tool_template(conn, tool_id, tool_arguments)

        assert result == {"name": "John Doe"}

    @pytest.mark.asyncio
    async def test_render_template_empty_template_skipped(self) -> None:
        """Test that fields with empty templates are skipped."""
        conn = AsyncMock()
        tool_id = uuid.uuid4()
        tool_arguments = {"description": "Test description"}

        mock_row_empty = MagicMock()
        mock_row_empty.name = "name"
        mock_row_empty.field_type = "string"
        mock_row_empty.template = ""

        mock_row_with_template = MagicMock()
        mock_row_with_template.name = "description"
        mock_row_with_template.field_type = "string"
        mock_row_with_template.template = "{{ description }}"

        with patch(
            "app.v5.infra.tools.render_tool_template.execute_sql_typed",
            new_callable=AsyncMock,
            return_value=[mock_row_empty, mock_row_with_template],
        ):
            result = await render_tool_template(conn, tool_id, tool_arguments)

        assert "name" not in result
        assert result == {"description": "Test description"}

    @pytest.mark.asyncio
    async def test_render_template_type_conversion(self) -> None:
        """Test that rendered values are converted to correct types."""
        conn = AsyncMock()
        tool_id = uuid.uuid4()
        tool_arguments = {"age": "25", "is_active": "true"}

        mock_row_age = MagicMock()
        mock_row_age.name = "age"
        mock_row_age.field_type = "number"
        mock_row_age.template = "{{ age }}"

        mock_row_bool = MagicMock()
        mock_row_bool.name = "is_active"
        mock_row_bool.field_type = "boolean"
        mock_row_bool.template = "{{ is_active }}"

        with patch(
            "app.v5.infra.tools.render_tool_template.execute_sql_typed",
            new_callable=AsyncMock,
            return_value=[mock_row_age, mock_row_bool],
        ):
            result = await render_tool_template(conn, tool_id, tool_arguments)

        assert result["age"] == 25.0
        assert result["is_active"] is True

    @pytest.mark.asyncio
    async def test_render_template_error_handling(self) -> None:
        """Test that template errors don't crash the function."""
        conn = AsyncMock()
        tool_id = uuid.uuid4()
        tool_arguments = {"valid_field": "test"}

        mock_row_valid = MagicMock()
        mock_row_valid.name = "valid_field"
        mock_row_valid.field_type = "string"
        mock_row_valid.template = "{{ valid_field }}"

        mock_row_invalid = MagicMock()
        mock_row_invalid.name = "invalid_field"
        mock_row_invalid.field_type = "string"
        mock_row_invalid.template = "{{ invalid_field. }}"  # Invalid syntax

        with patch(
            "app.v5.infra.tools.render_tool_template.execute_sql_typed",
            new_callable=AsyncMock,
            return_value=[mock_row_valid, mock_row_invalid],
        ):
            result = await render_tool_template(conn, tool_id, tool_arguments)

        assert "valid_field" in result
        assert "invalid_field" not in result


class TestGetRenderedTemplateValues:
    """Tests for get_rendered_template_values function."""

    @pytest.mark.asyncio
    async def test_get_rendered_values_found(self) -> None:
        """Test retrieving rendered values when they exist."""
        tool_call_id = uuid.uuid4()
        rendered_data = {"name": "John", "age": 25}

        mock_result = MagicMock()
        mock_result.result_json = rendered_data

        conn = AsyncMock()

        with patch(
            "app.v5.infra.tools.render_tool_template.execute_sql_typed",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            result = await get_rendered_template_values(conn, tool_call_id)

        assert result == rendered_data

    @pytest.mark.asyncio
    async def test_get_rendered_values_not_found(self) -> None:
        """Test retrieving rendered values when they don't exist."""
        tool_call_id = uuid.uuid4()
        conn = AsyncMock()

        mock_result = MagicMock()
        mock_result.result_json = None

        with patch(
            "app.v5.infra.tools.render_tool_template.execute_sql_typed",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            result = await get_rendered_template_values(conn, tool_call_id)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_rendered_values_json_string(self) -> None:
        """Test retrieving rendered values from JSON string."""
        import json

        tool_call_id = uuid.uuid4()
        rendered_data = {"name": "John", "age": 25}
        json_string = json.dumps(rendered_data)

        mock_result = MagicMock()
        mock_result.result_json = json_string

        conn = AsyncMock()

        with patch(
            "app.v5.infra.tools.render_tool_template.execute_sql_typed",
            new_callable=AsyncMock,
            return_value=mock_result,
        ):
            result = await get_rendered_template_values(conn, tool_call_id)

        assert result == rendered_data
