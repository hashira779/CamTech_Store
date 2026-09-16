import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    func,
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.datetime_utils import utc_now

def gen_id():
    return str(uuid.uuid4())

from sqlalchemy.dialects.postgresql import JSONB

class Role(Base):
    __tablename__ = "roles"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    permissions = Column(JSONB, default=list, nullable=False)
    is_system = Column("isSystem", Boolean, default=False, nullable=False)
    
    __table_args__ = (
        Index("ix_roles_org_id", "organizationId"),
    )

class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column("userId", String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_id = Column("roleId", String, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)

    user = relationship("User", back_populates="user_roles")
    role = relationship("Role")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column("passwordHash", String, nullable=False)
    roles = Column(Text, default='["STAFF"]', nullable=False)  # JSON-encoded array string (backward-compatible)
    location_id = Column("locationId", String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=utc_now, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    organization = relationship("Organization", back_populates="users")
    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    passkeys = relationship("UserPasskey", back_populates="user", cascade="all, delete-orphan")


class UserPasskey(Base):
    """A registered WebAuthn credential (passkey) belonging to a user.

    rp_id is stored per credential and re-checked at authentication time, so a
    passkey created under the storefront RP can never satisfy a staff ceremony
    even if both RPs resolve to the same user record.
    """

    __tablename__ = "user_passkeys"

    id = Column(String, primary_key=True, default=gen_id)
    user_id = Column("userId", String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)

    # Base64url-encoded credential ID as returned by the authenticator. Unique
    # platform-wide: the same physical credential must never map to two users.
    credential_id = Column("credentialId", String, unique=True, nullable=False)
    public_key = Column("publicKey", LargeBinary, nullable=False)

    # Replay defence. Many platform authenticators always report 0, so this is
    # advisory: we reject only a decrease from a previously non-zero counter.
    # server_default matters because CI builds the schema with create_all and
    # then exercises it with raw SQL, which never sees the Python-side default.
    sign_count = Column("signCount", Integer, nullable=False, default=0, server_default="0")

    rp_id = Column("rpId", String, nullable=False)
    # Human label so a user can tell their devices apart when revoking one.
    name = Column(String, nullable=False, default="Passkey", server_default="Passkey")
    transports = Column(Text, nullable=True)  # JSON array e.g. ["internal","hybrid"]
    aaguid = Column(String, nullable=True)
    backed_up = Column("backedUp", Boolean, nullable=False, default=False, server_default="false")

    created_at = Column("createdAt", DateTime, default=utc_now, server_default=func.now(), nullable=False)
    last_used_at = Column("lastUsedAt", DateTime, nullable=True)

    user = relationship("User", back_populates="passkeys")

    __table_args__ = (
        Index("ix_user_passkeys_user_rp", "userId", "rpId"),
    )
