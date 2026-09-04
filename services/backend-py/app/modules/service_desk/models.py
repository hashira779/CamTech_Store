import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.core.db_enums import pg_enum

def gen_id():
    return str(uuid.uuid4())

class ServiceTicket(Base):
    __tablename__ = "service_tickets"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    ticket_number = Column("ticketNumber", String, nullable=False)
    subject = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(pg_enum("TicketPriority"), default="MEDIUM", nullable=False)
    status = Column(pg_enum("TicketStatus"), default="OPEN", nullable=False)
    category = Column(String, default="GENERAL", nullable=False)
    assigned_to_id = Column("assignedToId", String, nullable=True)
    reporter_id = Column("reporterId", String, nullable=True)
    customer_id = Column("customerId", String, nullable=True)
    resolution = Column(String, nullable=True)
    resolved_at = Column("resolvedAt", DateTime, nullable=True)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    comments = relationship("TicketComment", back_populates="ticket", cascade="all, delete-orphan")

class TicketComment(Base):
    __tablename__ = "ticket_comments"

    id = Column(String, primary_key=True, default=gen_id)
    ticket_id = Column("ticketId", String, ForeignKey("service_tickets.id"), nullable=False)
    author_id = Column("authorId", String, nullable=True)
    author_name = Column("authorName", String, nullable=False)
    comment = Column(Text, nullable=False)
    is_internal = Column("isInternal", Boolean, default=False, nullable=False)
    created_at = Column("createdAt", DateTime, default=datetime.datetime.utcnow, nullable=False)

    ticket = relationship("ServiceTicket", back_populates="comments")
