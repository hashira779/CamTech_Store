import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Numeric,
    DateTime,
    text,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.datetime_utils import utc_now

def gen_id():
    return str(uuid.uuid4())

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True, default=gen_id)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    currency = Column(String, default="USD", server_default=text("'USD'"), nullable=False)
    timezone = Column(String, default="UTC", server_default=text("'UTC'"), nullable=False)
    tax_rate_pct = Column("taxRatePct", Numeric(14, 4), default=10, server_default=text("10"), nullable=False)
    business_type = Column("businessType", String, default="RETAIL", server_default=text("'RETAIL'"), nullable=False)
    settings = Column(String, nullable=True)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    users = relationship("User", back_populates="organization")

class PaywayConfig(Base):
    __tablename__ = "payway_configs"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True)
    merchant_id = Column("merchantId", String, nullable=False)
    public_key = Column("publicKey", String, nullable=False)
    rsa_public_key = Column("rsaPublicKey", String, nullable=True)   # AES-256-GCM encrypted at rest
    rsa_private_key = Column("rsaPrivateKey", String, nullable=True) # AES-256-GCM encrypted at rest
    is_production = Column("isProduction", Boolean, default=False, server_default=text("false"), nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization")

    # ── Encrypted field helpers ────────────────────────────────────
    def set_rsa_public_key(self, plaintext: str | None) -> None:
        """Encrypt and store RSA public key."""
        if plaintext:
            from app.core.crypto import EncryptionService
            self.rsa_public_key = EncryptionService.encrypt(plaintext)
        else:
            self.rsa_public_key = None

    def get_rsa_public_key(self) -> str | None:
        """Decrypt and return RSA public key."""
        if self.rsa_public_key:
            from app.core.crypto import EncryptionService
            return EncryptionService.decrypt(self.rsa_public_key)
        return None

    def set_rsa_private_key(self, plaintext: str | None) -> None:
        """Encrypt and store RSA private key."""
        if plaintext:
            from app.core.crypto import EncryptionService
            self.rsa_private_key = EncryptionService.encrypt(plaintext)
        else:
            self.rsa_private_key = None

    def get_rsa_private_key(self) -> str | None:
        """Decrypt and return RSA private key."""
        if self.rsa_private_key:
            from app.core.crypto import EncryptionService
            return EncryptionService.decrypt(self.rsa_private_key)
        return None
