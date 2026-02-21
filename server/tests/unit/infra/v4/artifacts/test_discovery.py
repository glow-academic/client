"""Unit tests for artifact discovery helpers."""

import uuid
from unittest.mock import AsyncMock

import pytest

from app.infra.v4.artifacts.discovery import (
    extract_template_variable_name,
    get_agent_end_event_name,
    get_resource_output_schema_fields,
    get_resource_schema_fields,
    get_resource_sql_function_name,
    get_resource_table_columns,
    map_template_values_to_table_columns,
)
from app.registry.resources import RESOURCE_OUTPUT_SCHEMAS


class TestExtractTemplateVariableName:
    """Test extract_template_variable_name function."""

    def test_simple_variable(self):
        """Test extracting simple variable name."""
        assert extract_template_variable_name("{{ message }}") == "message"

    def test_variable_with_property(self):
        """Test extracting variable name from template with property."""
        assert extract_template_variable_name("{{ variable.property }}") == "variable"

    def test_variable_with_filter(self):
        """Test extracting variable name from template with filter."""
        assert extract_template_variable_name("{{ variable|filter }}") == "variable"

    def test_empty_template(self):
        """Test empty template returns None."""
        assert extract_template_variable_name("") is None
        assert extract_template_variable_name(None) is None

    def test_no_variable(self):
        """Test template without variable returns None."""
        assert extract_template_variable_name("plain text") is None


class TestGetResourceSqlFunctionName:
    """Test get_resource_sql_function_name function."""

    @pytest.mark.asyncio
    async def test_finds_singular_function(self):
        """Test finding singular function name."""
        from unittest.mock import patch

        conn = AsyncMock()
        mock_row = {"function_name": "api_create_persona_v4"}
        conn.fetchrow = AsyncMock(return_value=mock_row)

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_resource_sql_function_name_v4", "public"),
            ):
                result = await get_resource_sql_function_name(conn, "persona")

        assert result == "api_create_persona_v4"

    @pytest.mark.asyncio
    async def test_finds_plural_function(self):
        """Test finding plural function name."""
        from unittest.mock import patch

        conn = AsyncMock()
        mock_row = {"function_name": "api_create_personas_v4"}
        conn.fetchrow = AsyncMock(return_value=mock_row)

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_resource_sql_function_name_v4", "public"),
            ):
                result = await get_resource_sql_function_name(conn, "personas")

        assert result == "api_create_personas_v4"

    @pytest.mark.asyncio
    async def test_resource_not_found(self):
        """Test when resource doesn't exist."""
        from unittest.mock import patch

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)  # function returns no rows

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_resource_sql_function_name_v4", "public"),
            ):
                result = await get_resource_sql_function_name(conn, "nonexistent")

        assert result is None

    @pytest.mark.asyncio
    async def test_function_not_found(self):
        """Test when function doesn't exist."""
        from unittest.mock import patch

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)  # function returns no rows

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_resource_sql_function_name_v4", "public"),
            ):
                result = await get_resource_sql_function_name(conn, "unknown")

        assert result is None


class TestGetResourceTableColumns:
    """Test get_resource_table_columns function."""

    @pytest.mark.asyncio
    async def test_returns_columns(self):
        """Test returning table columns."""
        from unittest.mock import patch

        conn = AsyncMock()
        mock_rows = [
            {
                "name": "name",
                "data_type": "text",
                "is_nullable": True,
                "column_default": None,
            },
            {
                "name": "active",
                "data_type": "boolean",
                "is_nullable": False,
                "column_default": "true",
            },
        ]
        conn.fetch = AsyncMock(return_value=mock_rows)

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_resource_table_columns_v4", "public"),
            ):
                result = await get_resource_table_columns(conn, "names")

        assert len(result) == 2
        assert result[0]["name"] == "name"
        assert result[0]["data_type"] == "text"
        assert result[0]["is_nullable"] is True
        assert result[1]["name"] == "active"
        assert result[1]["is_nullable"] is False

    @pytest.mark.asyncio
    async def test_filters_system_columns(self):
        """Test that system columns are filtered out."""
        from unittest.mock import patch

        conn = AsyncMock()
        # Note: SQL function filters system columns, so mock should only return non-system columns
        mock_rows = [
            {
                "name": "name",
                "data_type": "text",
                "is_nullable": False,
                "column_default": None,
            },
        ]
        conn.fetch = AsyncMock(return_value=mock_rows)

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_resource_table_columns_v4", "public"),
            ):
                result = await get_resource_table_columns(conn, "names")

        # SQL function filters out system columns
        assert len(result) == 1
        assert result[0]["name"] == "name"


class TestGetResourceSchemaFields:
    """Test get_resource_schema_fields function."""

    def test_returns_schema_fields_from_registry(self):
        """Test returning schema fields from RESOURCE_OUTPUT_SCHEMAS registry."""
        result = get_resource_schema_fields("names")

        assert len(result) == len(RESOURCE_OUTPUT_SCHEMAS["names"])
        assert result[0]["name"] == "id"
        assert result[0]["field_type"] == "string"
        assert result[0]["required"] is False
        assert result[0]["position"] == 0
        assert result[0]["template"] == ""

    def test_unknown_resource_returns_empty(self):
        """Test that unknown resource type returns empty list."""
        result = get_resource_schema_fields("nonexistent_resource")
        assert result == []

    def test_colors_has_multiple_fields(self):
        """Test resource with multiple output fields."""
        result = get_resource_schema_fields("colors")
        assert len(result) == 4
        field_names = [f["name"] for f in result]
        assert "description" in field_names
        assert "hex_code" in field_names
        assert "id" in field_names
        assert "name" in field_names


class TestGetResourceOutputSchemaFields:
    """Test get_resource_output_schema_fields function."""

    @pytest.mark.asyncio
    async def test_returns_output_schema_fields(self):
        """Test returning output schema fields."""
        from unittest.mock import patch

        conn = AsyncMock()
        tool_id = str(uuid.uuid4())
        mock_rows = [
            {
                "name": "content",
                "field_type": "string",
                "required": True,
                "position": 0,
                "template": "{{ message }}",
            },
        ]
        conn.fetch = AsyncMock(return_value=mock_rows)

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(
                    True,
                    "api_get_resource_output_schema_fields_v4",
                    "public",
                ),
            ):
                result = await get_resource_output_schema_fields(conn, tool_id)

        assert len(result) == 1
        assert result[0]["name"] == "content"
        assert result[0]["template"] == "{{ message }}"


class TestMapTemplateValuesToTableColumns:
    """Test map_template_values_to_table_columns function."""

    @pytest.mark.asyncio
    async def test_direct_match(self):
        """Test direct match between schema field and table column."""
        conn = AsyncMock()

        from unittest.mock import patch

        # Mock table columns (only one DB call now — schema fields come from registry)
        conn.fetch = AsyncMock(
            return_value=[
                {
                    "name": "name",
                    "data_type": "text",
                    "is_nullable": False,
                    "column_default": None,
                },
            ]
        )

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_function_v4", "public"),
            ):
                template_values = {"name": "Test Name"}
                result = await map_template_values_to_table_columns(
                    conn, "names", template_values
                )

        assert result == {"name": "Test Name"}

    @pytest.mark.asyncio
    async def test_template_extraction(self):
        """Test mapping via template variable extraction with patched registry."""
        conn = AsyncMock()

        from unittest.mock import patch

        # Mock table columns (only one DB call)
        conn.fetch = AsyncMock(
            return_value=[
                {
                    "name": "message",
                    "data_type": "text",
                    "is_nullable": False,
                    "column_default": None,
                },
            ]
        )

        # Patch registry to have a "contents" resource with template
        mock_schemas = {
            "contents": [{"name": "content", "field_type": "string"}],
        }

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_function_v4", "public"),
            ):
                with patch(
                    "app.infra.v4.artifacts.discovery.get_resource_schema_fields",
                    return_value=[
                        {
                            "name": "content",
                            "field_type": "string",
                            "required": True,
                            "position": 0,
                            "template": "{{ message }}",
                        },
                    ],
                ):
                    template_values = {"content": "Test Content"}
                    result = await map_template_values_to_table_columns(
                        conn, "contents", template_values
                    )

        # Should map "content" (schema field) to "message" (table column) via template
        assert result == {"message": "Test Content"}

    @pytest.mark.asyncio
    async def test_with_tool_id(self):
        """Test mapping with tool_id provided."""
        conn = AsyncMock()
        tool_id = str(uuid.uuid4())

        from unittest.mock import patch

        # Mock table columns and output schema fields
        conn.fetch = AsyncMock(
            side_effect=[
                [  # get_resource_table_columns
                    {
                        "name": "name",
                        "data_type": "text",
                        "is_nullable": False,
                        "column_default": None,
                    },
                ],
                [  # get_resource_output_schema_fields (with tool_id)
                    {
                        "name": "name",
                        "field_type": "string",
                        "required": True,
                        "position": 0,
                        "template": "",
                    },
                ],
            ]
        )

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_function_v4", "public"),
            ):
                template_values = {"name": "Test Name"}
                result = await map_template_values_to_table_columns(
                    conn, "names", template_values, tool_id
                )

        assert result == {"name": "Test Name"}


class TestGetAgentEndEventName:
    """Test get_agent_end_event_name function."""

    @pytest.mark.asyncio
    async def test_artifact_exists(self):
        """Test when artifact exists."""
        from unittest.mock import patch

        conn = AsyncMock()
        mock_row = {"event_name": "scenario_end"}
        conn.fetchrow = AsyncMock(return_value=mock_row)

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_agent_end_event_name_v4", "public"),
            ):
                result = await get_agent_end_event_name(conn, "scenario")

        assert result == "scenario_end"

    @pytest.mark.asyncio
    async def test_artifact_not_found(self):
        """Test when artifact doesn't exist."""
        from unittest.mock import patch

        conn = AsyncMock()
        conn.fetchrow = AsyncMock(return_value=None)  # function returns no rows

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_agent_end_event_name_v4", "public"),
            ):
                result = await get_agent_end_event_name(conn, "unknown")

        assert result == "text_end"

    @pytest.mark.asyncio
    async def test_audio_special_case(self):
        """Test audio maps to voice_end."""
        from unittest.mock import patch

        conn = AsyncMock()
        mock_row = {"event_name": "voice_end"}
        conn.fetchrow = AsyncMock(return_value=mock_row)

        with patch(
            "app.infra.v4.artifacts.discovery.load_sql",
            return_value="CREATE FUNCTION...",
        ):
            with patch(
                "app.infra.v4.artifacts.discovery._detect_function_in_sql",
                return_value=(True, "api_get_agent_end_event_name_v4", "public"),
            ):
                result = await get_agent_end_event_name(conn, "audio")

        assert result == "voice_end"
