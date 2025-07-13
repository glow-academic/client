import base64
import os

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
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


def decrypt_api_key(encrypted_key: str) -> str:
    """Decrypt API key using the same method as the TypeScript encryptProviderKey/decryptProviderKey functions"""
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

    # Remove PKCS7 padding
    padding_length = decrypted_padded[-1]
    decrypted = decrypted_padded[:-padding_length]

    return decrypted.decode("utf-8")
