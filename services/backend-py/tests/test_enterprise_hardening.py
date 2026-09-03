import pytest
from app.core.security import (
    create_access_token, create_refresh_token, decode_access_token,
    decode_refresh_token, generate_totp_secret, generate_totp_code,
    verify_totp_code, get_totp_uri
)
from app.core.crypto import EncryptionService

def test_refresh_token_lifecycle():
    user_payload = {"sub": "usr_test123", "orgId": "org_test123"}
    refresh_token = create_refresh_token(user_payload)
    assert refresh_token is not None

    decoded = decode_refresh_token(refresh_token)
    assert decoded is not None
    assert decoded["sub"] == "usr_test123"
    assert decoded["orgId"] == "org_test123"
    assert decoded["type"] == "refresh"

    # Ensure access token decoder rejects refresh tokens
    assert decode_access_token(refresh_token) is None

    # Ensure refresh token decoder rejects access tokens
    access_token = create_access_token(user_payload)
    assert decode_refresh_token(access_token) is None

def test_mfa_totp_generation_and_verification():
    secret = generate_totp_secret()
    assert len(secret) >= 16

    uri = get_totp_uri(secret, "user@mystore.test")
    assert uri.startswith("otpauth://totp/MyStore:user@mystore.test")
    assert secret in uri

    code = generate_totp_code(secret)
    assert len(code) == 6
    assert code.isdigit()

    # Valid code should pass
    assert verify_totp_code(secret, code) is True

    # Bad codes should fail
    assert verify_totp_code(secret, "000000") is False or code == "000000"
    assert verify_totp_code(secret, "invalid") is False
    assert verify_totp_code(secret, "") is False

def test_encryption_at_rest_service():
    plaintext = "my-ultra-secret-api-key-or-db-password-123"
    encrypted = EncryptionService.encrypt(plaintext)
    assert encrypted != plaintext
    assert len(encrypted) > 20

    decrypted = EncryptionService.decrypt(encrypted)
    assert decrypted == plaintext

    # Tampered token should fail decryption
    tampered = encrypted[:-4] + "AAAA"
    with pytest.raises(ValueError):
        EncryptionService.decrypt(tampered)
