import base64
import os

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes, padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from dotenv import load_dotenv

load_dotenv()

ALGORITHM = "AES"
IV_LENGTH = 16
SALT_LENGTH = 32
KEY_LENGTH = 32
PBKDF2_ITERATIONS = 100000


def derive_key(password: str, salt: bytes) -> bytes:
    """Generate a key from the secret using PBKDF2 (matching Node.js implementation)"""
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=KEY_LENGTH,
        salt=salt,
        iterations=PBKDF2_ITERATIONS,
        backend=default_backend(),
    )
    return kdf.derive(password.encode("utf-8"))


def encrypt_api_key(api_key: str) -> str:
    """Encrypt API key using AES-256-CBC with PBKDF2 key derivation (matching TypeScript implementation)"""
    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise ValueError("SECRET_KEY environment variable is not set")

    # Generate random salt and IV
    salt = os.urandom(SALT_LENGTH)
    iv = os.urandom(IV_LENGTH)

    # Derive the key using PBKDF2
    key = derive_key(secret_key, salt)

    # Add PKCS7 padding
    padder = padding.PKCS7(algorithms.AES.block_size).padder()
    padded_data = padder.update(api_key.encode("utf-8")) + padder.finalize()

    # Create cipher and encrypt
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    encryptor = cipher.encryptor()
    encrypted_data = encryptor.update(padded_data) + encryptor.finalize()

    # Combine salt + iv + encrypted data
    combined = salt + iv + encrypted_data

    # Return base64 encoded string
    return base64.b64encode(combined).decode("utf-8")


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt API key using the same method as the TypeScript encryptProviderKey/decryptProviderKey functions"""
    # Handle None or empty string
    if not encrypted_key:
        raise ValueError(
            "API key is missing - scenario/persona/provider chain is broken."
        )

    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise ValueError("SECRET_KEY environment variable is not set")

    # Decode the base64 combined data
    combined = base64.b64decode(encrypted_key)

    # Extract components (salt + iv + encrypted data)
    salt = combined[:SALT_LENGTH]
    iv = combined[SALT_LENGTH : SALT_LENGTH + IV_LENGTH]
    encrypted_data = combined[SALT_LENGTH + IV_LENGTH :]

    # Derive the key using PBKDF2
    key = derive_key(secret_key, salt)

    # Create cipher and decrypt
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv), backend=default_backend())
    decryptor = cipher.decryptor()

    # Decrypt the data
    decrypted_padded = decryptor.update(encrypted_data) + decryptor.finalize()

    # Remove PKCS7 padding using standard unpadder
    unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
    decrypted = unpadder.update(decrypted_padded) + unpadder.finalize()

    return decrypted.decode("utf-8")
