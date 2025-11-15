"""
Tests for app.utils.auth.encrypt_api_key
"""

import os
from unittest.mock import patch

import pytest
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.auth.encrypt_api_key import encrypt_api_key


class TestEncrypt_Api_Key:
    """Tests for encrypt_api_key function."""

    def test_encrypt_api_key_success(self) -> None:
        """Test successful encrypt_api_key execution."""
        # Mock environment variable
        with patch.dict(os.environ, {"SECRET_KEY": "test_secret_key"}):
            original_key = "my-secret-api-key"

            # Encrypt the key
            encrypted = encrypt_api_key(original_key)

            # Should return a base64 encoded string
            assert isinstance(encrypted, str)
            assert len(encrypted) > 0

            # Should be able to decrypt it back
            decrypted = decrypt_api_key(encrypted)
            assert decrypted == original_key

    def test_encrypt_api_key_missing_secret(self) -> None:
        """Test encrypt_api_key without SECRET_KEY."""
        # Test without SECRET_KEY
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(
                ValueError, match="SECRET_KEY environment variable is not set"
            ):
                encrypt_api_key("test-key")

