import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
)
from app.core.database import Base
from app.core.db_enums import pg_enum

def gen_id():
    return str(uuid.uuid4())

class Location(Base):
    __tablename__ = "locations"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    parent_id = Column("parentId", String, nullable=True)
    name = Column(String, nullable=False)
    code = Column(String, nullable=True)
    type = Column(pg_enum("LocationType"), default="BRANCH", nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
