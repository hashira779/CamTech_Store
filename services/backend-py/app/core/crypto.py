import os
import base64
import hashlib
from typing import Optional
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import settings

class EncryptionService:
    """
    AES-256-GCM Field-Level Encryption Service (§66).
    Encrypts sensitive data (passwords, secrets, credentials, tokens)
    at rest with authenticated encryption (nonce + ciphertext + tag).
    """

    @classmethod
    def _get_key(cls, custom_key: Optional[str] = None) -> bytes:
        raw = (custom_key or settings.ENCRYPTION_KEY).encode("utf-8")
        # Ensure exact 32 bytes (256 bits) for AES-256
        return hashlib.sha256(raw).digest()

    @classmethod
    def encrypt(cls, plaintext: str, custom_key: Optional[str] = None) -> str:
        """
        Encrypts plaintext string with AES-256-GCM.
        Returns URL-safe base64 string: base64(12-byte-nonce + ciphertext + 16-byte-tag).
        """
        if not plaintext:
            return ""
        key = cls._get_key(custom_key)
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)  # 96-bit nonce standard for GCM
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        payload = nonce + ciphertext
        return base64.urlsafe_b64encode(payload).decode("utf-8")

    @classmethod
    def decrypt(cls, encrypted_token: str, custom_key: Optional[str] = None) -> str:
        """
        Decrypts an AES-256-GCM encrypted token.
        Raises ValueError if token has been tampered with or corrupted.
        """
        if not encrypted_token:
            return ""
        try:
            payload = base64.urlsafe_b64decode(encrypted_token.encode("utf-8"))
            if len(payload) < 28:  # 12 nonce + 16 auth tag minimum
                raise ValueError("Invalid encrypted payload size")
            nonce = payload[:12]
            ciphertext = payload[12:]
            key = cls._get_key(custom_key)
            aesgcm = AESGCM(key)
            decrypted = aesgcm.decrypt(nonce, ciphertext, None)
            return decrypted.decode("utf-8")
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}") from e
