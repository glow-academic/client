"""Unit tests for app.v5.infra.documents.format_document_template_context."""

from app.v5.infra.documents.format_document_template_context import (
    format_document_template_context,
)


class TestFormatDocumentTemplateContext:
    """Tests for format_document_template_context function."""

    def test_format_document_template_context_empty(self) -> None:
        """Test format_document_template_context with empty inputs."""
        # Arrange & Act
        result = format_document_template_context()

        # Assert
        assert isinstance(result, list)
        assert len(result) == 0

    def test_format_document_template_context_with_document_name(self) -> None:
        """Test format_document_template_context with document name."""
        # Arrange & Act
        result = format_document_template_context(document_name="Test Document")

        # Assert
        assert isinstance(result, list)
        assert len(result) > 0
        # Should contain document name in content

    def test_format_document_template_context_with_fields(self) -> None:
        """Test format_document_template_context with fields."""
        # Arrange
        fields = [
            {
                "item_name": "field1",
                "item_description": "Field 1 description",
                "param_name": "param1",
                "param_description": "Param 1 description",
            }
        ]

        # Act
        result = format_document_template_context(fields=fields)

        # Assert
        assert isinstance(result, list)
        assert len(result) > 0

    def test_format_document_template_context_with_all_fields(self) -> None:
        """Test format_document_template_context with all fields."""
        # Arrange
        fields = [
            {
                "item_name": "field1",
                "item_description": "Field 1 description",
                "param_name": "param1",
                "param_description": "Param 1 description",
            }
        ]

        # Act
        result = format_document_template_context(
            document_name="Test Document",
            document_description="Test Description",
            department_name="Test Department",
            fields=fields,
        )

        # Assert
        assert isinstance(result, list)
        assert len(result) > 0
