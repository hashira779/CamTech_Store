import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Numeric,
    DateTime,
    text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base

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
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    users = relationship("User", back_populates="organization")
