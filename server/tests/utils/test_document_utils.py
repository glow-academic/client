"""
Tests for app.utils.document
"""

from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from app.utils.document import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest


class TestGet_Document_Info:
    """Tests for get_document_info function."""

    def test_get_document_info_success(self, mock_session):
        """Test successful get_document_info execution."""

        from app.models import Documents
        from app.utils.document import get_document_info

        # Create mock documents
        doc1_id = uuid4()
        doc2_id = uuid4()
        mock_doc1 = Documents(
            id=doc1_id, name="Test Document 1", mime_type="application/pdf"
        )
        mock_doc2 = Documents(
            id=doc2_id, name="Test Document 2", mime_type="text/plain"
        )

        # Mock the database query
        mock_session.exec.return_value.all.return_value = [mock_doc1, mock_doc2]

        result = get_document_info([doc1_id, doc2_id], mock_session)

        assert result["role"] == "user"
        assert "The following is the document information:" in result["content"]
        assert "Document Name: Test Document 1" in result["content"]
        assert "Document File Type: application/pdf" in result["content"]
        assert "Document Name: Test Document 2" in result["content"]
        assert "Document File Type: text/plain" in result["content"]

    def test_get_document_info_error(self, mock_session):
        """Test get_document_info error handling."""

        from app.utils.document import get_document_info

        # Mock the database query to return no documents
        mock_session.exec.return_value.all.return_value = []

        doc_ids = [uuid4(), uuid4()]

        with pytest.raises(ValueError, match="Documents not found for document ids"):
            get_document_info(doc_ids, mock_session)
