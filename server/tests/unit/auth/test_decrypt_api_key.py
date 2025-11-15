"""
Tests for app.utils.auth.decrypt_api_key
"""

import base64
import os
from unittest.mock import patch

import pytest
from app.utils.auth.decrypt_api_key import decrypt_api_key
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


class TestDecrypt_Api_Key:
    """Tests for decrypt_api_key function."""

    def test_decrypt_api_key_success(self) -> None:
        """Test successful decrypt_api_key execution."""
        # Mock environment variable
        with patch.dict(os.environ, {"SECRET_KEY": "test_secret_key"}):
            # Create test data with a key that's exactly 16 bytes (no padding needed)
            original_key = "test_api_key_16b"  # Exactly 16 characters
            secret_key = "test_secret_key"
            salt = os.urandom(32)  # Use exactly 32 bytes
            iv = os.urandom(16)  # Use exactly 16 bytes

            # Derive key using PBKDF2
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
                backend=default_backend(),
            )
            key = kdf.derive(secret_key.encode("utf-8"))

            # Create cipher and encryptor
            cipher = Cipher(
                algorithms.AES(key), modes.CBC(iv), backend=default_backend()
            )
            encryptor = cipher.encryptor()

            # Use standard PKCS7 padder
            padder = padding.PKCS7(algorithms.AES.block_size).padder()
            padded_data = (
                padder.update(original_key.encode("utf-8")) + padder.finalize()
            )

            encrypted_data = encryptor.update(padded_data) + encryptor.finalize()

            # Combine salt + iv + encrypted data
            combined = salt + iv + encrypted_data
            encrypted_key = base64.b64encode(combined).decode("utf-8")

            # Execute the function
            result = decrypt_api_key(encrypted_key)

            # Verify the result
            assert result == original_key

    def test_decrypt_api_key_error(self) -> None:
        """Test decrypt_api_key error handling."""
        # Test with missing SECRET_KEY
        with patch.dict(os.environ, {}, clear=True):
            with pytest.raises(
                ValueError, match="SECRET_KEY environment variable is not set"
            ):
                decrypt_api_key("invalid_key")

        # Test with invalid encrypted key
        with patch.dict(os.environ, {"SECRET_KEY": "test_secret_key"}):
            with pytest.raises(Exception):  # Could be ValueError or other crypto errors
                decrypt_api_key("invalid_base64_key")

