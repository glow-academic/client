"""
Tests for app.utils.document
"""

import uuid
from unittest.mock import MagicMock

import pytest
from sqlmodel import Session

from app.utils.document import get_document_info


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestGet_Document_Info:
    """Tests for get_document_info function."""

    def test_get_document_info_success(self, mock_session):
        """Test successful get_document_info execution."""
        # Mock the documents
        mock_document1 = MagicMock()
        mock_document1.name = "Test Document 1"
        mock_document1.mime_type = "application/pdf"

        mock_document2 = MagicMock()
        mock_document2.name = "Test Document 2"
        mock_document2.mime_type = "text/plain"

        mock_documents = [mock_document1, mock_document2]
        mock_session.exec.return_value.all.return_value = mock_documents

        document_ids = [uuid.uuid4(), uuid.uuid4()]
        result = get_document_info(document_ids, mock_session)

        # Verify that the document info was retrieved
        assert result["role"] == "user"
        assert "The following is the document information:" in result["content"]
        assert "Test Document 1" in result["content"]
        assert "Test Document 2" in result["content"]
        assert "application/pdf" in result["content"]
        assert "text/plain" in result["content"]
        mock_session.exec.assert_called_once()

    def test_get_document_info_not_found(self, mock_session):
        """Test get_document_info when documents are not found."""
        # Mock no documents found
        mock_session.exec.return_value.all.return_value = []

        document_ids = [uuid.uuid4()]

        # The function should raise an exception
        with pytest.raises(ValueError, match="Documents not found"):
            get_document_info(document_ids, mock_session)

        mock_session.exec.assert_called_once()


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `format_document_info`")
class TestFormat_Document_Info:
    """Tests for format_document_info function."""

    def test_format_document_info_success(self):
        """Test successful format_document_info execution."""
        # TODO: Implement test for format_document_info
        assert False, "IMPLEMENT: Test for format_document_info"

    def test_format_document_info_error(self):
        """Test format_document_info error handling."""
        # TODO: Implement error test for format_document_info
        assert False, "IMPLEMENT: Error test for format_document_info"
