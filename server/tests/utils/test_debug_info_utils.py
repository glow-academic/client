"""
Tests for app.utils.debug_info
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4
from app.utils.debug_info import *

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `debug_info`")
class TestDebug_Info:
    """Tests for debug_info function."""

    def test_debug_info_success(self):
        """Test successful debug_info execution."""
        # TODO: Implement test for debug_info
        assert False, "IMPLEMENT: Test for debug_info"

    def test_debug_info_error(self):
        """Test debug_info error handling."""
        # TODO: Implement error test for debug_info
        assert False, "IMPLEMENT: Error test for debug_info"

