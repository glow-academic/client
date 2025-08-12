"""
Tests for app.utils.guest
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from sqlmodel import Session
from uuid import uuid4
from app.utils.guest import *

@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest

@pytest.mark.skip(reason="TODO: implement tests for `find_default_guest_profile`")
class TestFind_Default_Guest_Profile:
    """Tests for find_default_guest_profile function."""

    def test_find_default_guest_profile_success(self):
        """Test successful find_default_guest_profile execution."""
        # TODO: Implement test for find_default_guest_profile
        assert False, "IMPLEMENT: Test for find_default_guest_profile"

    def test_find_default_guest_profile_error(self):
        """Test find_default_guest_profile error handling."""
        # TODO: Implement error test for find_default_guest_profile
        assert False, "IMPLEMENT: Error test for find_default_guest_profile"

