"""
Tests for app.utils.auth.derive_key
"""

import os

import pytest
from utils.auth.derive_key import derive_key


class TestDerive_Key:
    """Tests for derive_key function."""

    def test_derive_key_success(self) -> None:
        """Test successful derive_key execution."""
        # Test data
        password = "test_password"
        salt = os.urandom(32)  # Use exactly 32 bytes

        # Execute the function
        result = derive_key(password, salt)

        # Verify the result
        assert isinstance(result, bytes)
        assert len(result) == 32

        # Verify it's deterministic
        result2 = derive_key(password, salt)
        assert result == result2

    def test_derive_key_error(self) -> None:
        """Test derive_key error handling."""
        # Test with empty password
        salt = os.urandom(32)  # Use exactly 32 bytes
        result = derive_key("", salt)
        assert isinstance(result, bytes)
        assert len(result) == 32

        # Test with None password (should raise AttributeError)
        with pytest.raises(AttributeError):
            derive_key(None, salt)  # type: ignore[arg-type]
