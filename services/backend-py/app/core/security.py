import datetime
import hmac
import bcrypt
import jwt
from typing import Optional, Dict, Any
from app.core.config import settings

def hash_password(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=10)
    return bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (
        expires_delta or datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)

def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[datetime.timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + (
        expires_delta or datetime.timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        if payload.get("type") and payload.get("type") != "access":
            return None
        return payload
    except jwt.PyJWTError:
        return None

def decode_refresh_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload
    except jwt.PyJWTError:
        return None

def secure_compare(val1: str, val2: str) -> bool:
    return hmac.compare_digest(val1, val2)

# ==============================================================================
# MFA (RFC 6238 TOTP)
# ==============================================================================
import base64
import struct
import time
import secrets
import hashlib

def generate_totp_secret(length: int = 20) -> str:
    """Generates a base32-encoded random secret key for TOTP MFA."""
    raw_bytes = secrets.token_bytes(length)
    return base64.b32encode(raw_bytes).decode("utf-8").replace("=", "")

def generate_totp_code(secret: str, interval: int = 30, timestamp: Optional[float] = None) -> str:
    """Generates a 6-digit TOTP code for the given secret at the specified timestamp."""
    if timestamp is None:
        timestamp = time.time()
    counter = int(timestamp // interval)
    padding = "=" * ((8 - len(secret) % 8) % 8)
    key = base64.b32decode(secret + padding, casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = (struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1000000
    return f"{code:06d}"

def verify_totp_code(secret: str, code: str, window: int = 1, interval: int = 30) -> bool:
    """Verifies a 6-digit TOTP code against secret allowing for clock drift."""
    if not code or len(code.strip()) != 6:
        return False
    current_time = time.time()
    for step in range(-window, window + 1):
        expected = generate_totp_code(secret, interval=interval, timestamp=current_time + (step * interval))
        if secure_compare(expected, code.strip()):
            return True
    return False

def get_totp_uri(secret: str, account_name: str, issuer: str = "MyStore") -> str:
    """Returns an otpauth:// URI suitable for generating QR codes in Google/Microsoft Authenticator."""
    return f"otpauth://totp/{issuer}:{account_name}?secret={secret}&issuer={issuer}&algorithm=SHA1&digits=6&period=30"

