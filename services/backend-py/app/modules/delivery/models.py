import datetime
import uuid
from sqlalchemy import (
    Column,
    String,
    Boolean,
    Numeric,
    Integer,
    Float,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def gen_id():
    return str(uuid.uuid4())

class DeliveryDriver(Base):
    __tablename__ = "delivery_drivers"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    vehicle_type = Column("vehicleType", String, default="MOTORCYCLE", nullable=False)
    license_plate = Column("licensePlate", String, nullable=False)
    status = Column(String, default="IDLE", nullable=False)
    current_lat = Column("currentLat", Float, default=11.5564, nullable=False)
    current_lng = Column("currentLng", Float, default=104.9282, nullable=False)
    heading = Column(Float, default=0.0, nullable=True)
    battery_level = Column("batteryLevel", Integer, default=100, nullable=True)
    is_active = Column("isActive", Boolean, default=True, nullable=False)
    last_ping_at = Column("lastPingAt", DateTime(timezone=True), nullable=True)
    created_at = Column("createdAt", DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    orders = relationship("DeliveryOrder", back_populates="driver")

class DeliveryOrder(Base):
    __tablename__ = "delivery_orders"

    id = Column(String, primary_key=True, default=gen_id)
    organization_id = Column("organizationId", String, ForeignKey("organizations.id"), nullable=False)
    tracking_number = Column("trackingNumber", String, unique=True, nullable=False)
    sale_id = Column("saleId", String, ForeignKey("sales.id"), nullable=True)
    status = Column(String, default="PENDING", nullable=False)
    recipient_name = Column("recipientName", String, nullable=False)
    recipient_phone = Column("recipientPhone", String, nullable=False)
    delivery_address = Column("deliveryAddress", String, nullable=False)
    dest_lat = Column("destLat", Float, default=11.5564, nullable=False)
    dest_lng = Column("destLng", Float, default=104.9282, nullable=False)
    driver_id = Column("driverId", String, ForeignKey("delivery_drivers.id"), nullable=True)
    cod_amount = Column("codAmount", Numeric(14, 4), default=0, nullable=False)
    delivery_fee = Column("deliveryFee", Numeric(14, 4), default=2.50, nullable=False)
    distance_km = Column("distanceKm", Float, nullable=True)
    eta_minutes = Column("etaMinutes", Integer, nullable=True)
    proof_of_delivery = Column("proofOfDelivery", Text, nullable=True)
    notes = Column(Text, nullable=True)
    dispatched_at = Column("dispatchedAt", DateTime(timezone=True), nullable=True)
    delivered_at = Column("deliveredAt", DateTime(timezone=True), nullable=True)
    created_at = Column("createdAt", DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column("updatedAt", DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    driver = relationship("DeliveryDriver", back_populates="orders")
