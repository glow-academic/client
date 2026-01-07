"""Unit tests for app.infra.v4.tools.render_tool_template."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.infra.v4.tools.render_tool_template import (
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
    async def test_render_template_no_tool_id(self) -> None:
        """Test rendering when tool has no template_id."""
        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)

        tool_id = uuid.uuid4()
        tool_arguments = {"name": "test"}

        result = await render_tool_template(conn, tool_id, tool_arguments)

        assert result == {}

    @pytest.mark.asyncio
    async def test_render_template_no_schema(self) -> None:
        """Test rendering when template has no linked schema."""
        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            side_effect=[
                MagicMock(template_id=uuid.uuid4()),  # Tool has template_id
                None,  # No schema linked
            ]
        )

        tool_id = uuid.uuid4()
        tool_arguments = {"name": "test"}

        result = await render_tool_template(conn, tool_id, tool_arguments)

        assert result == {}

    @pytest.mark.asyncio
    async def test_render_template_simple_mapping(self) -> None:
        """Test rendering a simple template mapping."""
        template_id = uuid.uuid4()
        schema_id = uuid.uuid4()
        tool_id = uuid.uuid4()

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            side_effect=[
                MagicMock(template_id=template_id),  # Tool has template_id
                MagicMock(schema_id=schema_id),  # Schema linked
            ]
        )
        conn.fetch = AsyncMock(
            return_value=[
                MagicMock(
                    id=uuid.uuid4(),
                    name="name",
                    field_type="string",
                    template="{{ name }}",
                ),
            ]
        )

        tool_arguments = {"name": "John Doe"}

        result = await render_tool_template(conn, tool_id, tool_arguments)

        assert result == {"name": "John Doe"}

    @pytest.mark.asyncio
    async def test_render_template_empty_template_skipped(self) -> None:
        """Test that fields with empty templates are skipped."""
        template_id = uuid.uuid4()
        schema_id = uuid.uuid4()
        tool_id = uuid.uuid4()

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            side_effect=[
                MagicMock(template_id=template_id),
                MagicMock(schema_id=schema_id),
            ]
        )
        conn.fetch = AsyncMock(
            return_value=[
                MagicMock(
                    id=uuid.uuid4(),
                    name="name",
                    field_type="string",
                    template="",  # Empty template
                ),
                MagicMock(
                    id=uuid.uuid4(),
                    name="description",
                    field_type="string",
                    template="{{ description }}",
                ),
            ]
        )

        tool_arguments = {"description": "Test description"}

        result = await render_tool_template(conn, tool_id, tool_arguments)

        assert "name" not in result
        assert result == {"description": "Test description"}

    @pytest.mark.asyncio
    async def test_render_template_type_conversion(self) -> None:
        """Test that rendered values are converted to correct types."""
        template_id = uuid.uuid4()
        schema_id = uuid.uuid4()
        tool_id = uuid.uuid4()

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            side_effect=[
                MagicMock(template_id=template_id),
                MagicMock(schema_id=schema_id),
            ]
        )
        conn.fetch = AsyncMock(
            return_value=[
                MagicMock(
                    id=uuid.uuid4(),
                    name="age",
                    field_type="number",
                    template="{{ age }}",
                ),
                MagicMock(
                    id=uuid.uuid4(),
                    name="is_active",
                    field_type="boolean",
                    template="{{ is_active }}",
                ),
            ]
        )

        tool_arguments = {"age": "25", "is_active": "true"}

        result = await render_tool_template(conn, tool_id, tool_arguments)

        assert result["age"] == 25.0
        assert result["is_active"] is True

    @pytest.mark.asyncio
    async def test_render_template_error_handling(self) -> None:
        """Test that template errors don't crash the function."""
        template_id = uuid.uuid4()
        schema_id = uuid.uuid4()
        tool_id = uuid.uuid4()

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            side_effect=[
                MagicMock(template_id=template_id),
                MagicMock(schema_id=schema_id),
            ]
        )
        conn.fetch = AsyncMock(
            return_value=[
                MagicMock(
                    id=uuid.uuid4(),
                    name="valid_field",
                    field_type="string",
                    template="{{ valid_field }}",
                ),
                MagicMock(
                    id=uuid.uuid4(),
                    name="invalid_field",
                    field_type="string",
                    template="{{ invalid_field. }}",  # Invalid syntax
                ),
            ]
        )

        tool_arguments = {"valid_field": "test"}

        # Should not raise, but skip invalid field
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

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            return_value=MagicMock(result_json=rendered_data)
        )

        result = await get_rendered_template_values(conn, tool_call_id)

        assert result == rendered_data

    @pytest.mark.asyncio
    async def test_get_rendered_values_not_found(self) -> None:
        """Test retrieving rendered values when they don't exist."""
        tool_call_id = uuid.uuid4()

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)

        result = await get_rendered_template_values(conn, tool_call_id)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_rendered_values_json_string(self) -> None:
        """Test retrieving rendered values from JSON string."""
        import json

        tool_call_id = uuid.uuid4()
        rendered_data = {"name": "John", "age": 25}
        json_string = json.dumps(rendered_data)

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(
            return_value=MagicMock(result_json=json_string)
        )

        result = await get_rendered_template_values(conn, tool_call_id)

        assert result == rendered_data

