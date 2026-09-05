import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def gen_id():
    return str(uuid.uuid4())

class Role(Base):
    __tablename__ = "roles"

    name = Column(String, primary_key=True)
    description = Column(String, nullable=True)

class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column("userId", String, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role_name = Column("roleName", String, ForeignKey("roles.name", ondelete="CASCADE"), primary_key=True)

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column("passwordHash", String, nullable=False)
    roles = Column(Text, default='["STAFF"]', nullable=False)  # JSON-encoded array string
    location_id = Column("locationId", String, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="users")
