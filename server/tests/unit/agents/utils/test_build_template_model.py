"""Unit tests for app.infra.v4.agents.utils.build_template_model."""

import pytest
from pydantic import BaseModel, ValidationError

from app.infra.v4.agents.utils.build_template_model import build_template_model


class TestBuildTemplateModel:
    """Tests for build_template_model function."""

    def test_build_template_model_empty_schema(self) -> None:
        """Test build_template_model with empty schema."""
        # Arrange
        schema = {"name": "TestTemplate", "fields": []}

        # Act
        model = build_template_model(schema)

        # Assert
        assert issubclass(model, BaseModel)
        # Model should have no fields and forbid extra fields
        instance = model()
        assert isinstance(instance, BaseModel)

    def test_build_template_model_with_string_field(self) -> None:
        """Test build_template_model with string field."""
        # Arrange
        schema = {
            "name": "TestTemplate",
            "fields": [
                {
                    "name": "field1",
                    "type": "string",
                    "description": "Field 1 description",
                }
            ],
        }

        # Act
        model = build_template_model(schema)

        # Assert
        assert issubclass(model, BaseModel)
        instance = model(field1="test_value")
        assert instance.field1 == "test_value"

    def test_build_template_model_with_number_field(self) -> None:
        """Test build_template_model with number field (maps to str at top level)."""
        # Arrange
        schema = {
            "name": "TestTemplate",
            "fields": [
                {
                    "name": "field1",
                    "type": "number",
                    "description": "Field 1 description",
                }
            ],
        }

        # Act
        model = build_template_model(schema)

        # Assert - unknown top-level types (including "number") default to str
        assert issubclass(model, BaseModel)
        instance = model(field1="42")
        assert instance.field1 == "42"

    def test_build_template_model_forbids_extra_fields(self) -> None:
        """Test build_template_model forbids extra fields."""
        # Arrange
        schema = {
            "name": "TestTemplate",
            "fields": [
                {
                    "name": "field1",
                    "type": "string",
                    "description": "Field 1 description",
                }
            ],
        }

        # Act
        model = build_template_model(schema)

        # Assert
        assert issubclass(model, BaseModel)
        # Should raise ValidationError for extra fields
        with pytest.raises(ValidationError):
            model(field1="test", extra_field="should_fail")
