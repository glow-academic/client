"""Unit tests for app.infra.v4.tools.build_pydantic_fields."""

from app.infra.v4.tools.build_pydantic_fields import build_pydantic_fields


class TestBuildPydanticFields:
    """Tests for build_pydantic_fields function."""

    def test_build_pydantic_fields_empty_config(self) -> None:
        """Test build_pydantic_fields with empty config."""
        # Arrange
        tool_config = {}

        # Act
        result = build_pydantic_fields(tool_config)

        # Assert
        assert isinstance(result, dict)
        assert len(result) == 0

    def test_build_pydantic_fields_with_arguments(self) -> None:
        """Test build_pydantic_fields with arguments."""
        # Arrange
        tool_config = {
            "arguments": {
                "field1": {"type": "string", "description": "Field 1"},
                "field2": {"type": "number", "description": "Field 2"},
            },
            "argument_descriptions": {
                "field1": "Field 1 description",
                "field2": "Field 2 description",
            },
            "argument_defaults": {"field2": 10},
        }

        # Act
        result = build_pydantic_fields(tool_config)

        # Assert
        assert isinstance(result, dict)
        assert "field1" in result
        assert "field2" in result

    def test_build_pydantic_fields_with_defaults(self) -> None:
        """Test build_pydantic_fields with default values."""
        # Arrange
        tool_config = {
            "arguments": {
                "field1": {"type": "string", "description": "Field 1"},
            },
            "argument_descriptions": {
                "field1": "Field 1 description",
            },
            "argument_defaults": {"field1": "default_value"},
        }

        # Act
        result = build_pydantic_fields(tool_config)

        # Assert
        assert isinstance(result, dict)
        assert "field1" in result

