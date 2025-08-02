"""
Tests for app.utils.mime_utils
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4
from app.utils.mime_utils import *

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `infer_mime_from_name`")
class TestInfer_Mime_From_Name:
    """Tests for infer_mime_from_name function."""

    def test_infer_mime_from_name_success(self):
        """Test successful infer_mime_from_name execution."""
        # TODO: Implement test for infer_mime_from_name
        assert False, "IMPLEMENT: Test for infer_mime_from_name"

    def test_infer_mime_from_name_error(self):
        """Test infer_mime_from_name error handling."""
        # TODO: Implement error test for infer_mime_from_name
        assert False, "IMPLEMENT: Error test for infer_mime_from_name"


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `get_content_type`")
class TestGet_Content_Type:
    """Tests for get_content_type function."""

    def test_get_content_type_success(self):
        """Test successful get_content_type execution."""
        # TODO: Implement test for get_content_type
        assert False, "IMPLEMENT: Test for get_content_type"

    def test_get_content_type_error(self):
        """Test get_content_type error handling."""
        # TODO: Implement error test for get_content_type
        assert False, "IMPLEMENT: Error test for get_content_type"

