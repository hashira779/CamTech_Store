from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class DeliveryDriverDto(BaseModel):
    id: str
    organizationId: str
    name: str
    phone: str
    vehicleType: str
    licensePlate: str
    status: str
    currentLat: float
    currentLng: float
    heading: Optional[float] = 0.0
    batteryLevel: Optional[int] = 100
    activeOrdersCount: Optional[int] = 0
    lastPingAt: Optional[str] = None
    authStatus: Optional[str] = None
    telegramUserId: Optional[str] = None

class CreateDriverInput(BaseModel):
    name: str
    phone: str
    vehicleType: str = "MOTORCYCLE"
    licensePlate: str
    initialLat: Optional[float] = 11.5564
    initialLng: Optional[float] = 104.9282

class DriverLocationPingInput(BaseModel):
    driverId: str
    latitude: float
    longitude: float
    heading: Optional[float] = None
    batteryLevel: Optional[int] = None

class DeliveryOrderDto(BaseModel):
    id: str
    organizationId: str
    trackingNumber: str
    saleId: Optional[str] = None
    status: str
    recipientName: str
    recipientPhone: str
    deliveryAddress: str
    destLat: float
    destLng: float
    driverId: Optional[str] = None
    driverName: Optional[str] = None
    driverPhone: Optional[str] = None
    driverVehicle: Optional[str] = None
    codAmount: float = 0.0
    deliveryFee: float = 0.0
    distanceKm: Optional[float] = None
    etaMinutes: Optional[int] = None
    proofOfDelivery: Optional[str] = None
    notes: Optional[str] = None
    createdAt: str
    dispatchedAt: Optional[str] = None
    deliveredAt: Optional[str] = None
    items: Optional[List[Dict[str, Any]]] = None
    saleNumber: Optional[str] = None
    totalAmount: Optional[float] = None
    wmsStatus: Optional[str] = None

class CreateDeliveryOrderInput(BaseModel):
    recipientName: Optional[str] = None
    customerName: Optional[str] = None
    recipientPhone: Optional[str] = None
    customerPhone: Optional[str] = None
    deliveryAddress: str
    destLat: Optional[float] = 11.5564
    destLng: Optional[float] = 104.9282
    saleId: Optional[str] = None
    codAmount: Optional[float] = 0.0
    deliveryFee: Optional[float] = 2.50
    notes: Optional[str] = None
    driverId: Optional[str] = None
    items: Optional[List[Any]] = None
    paymentMethod: Optional[str] = None

class UpdateDeliveryStatusInput(BaseModel):
    status: str
    proofOfDelivery: Optional[str] = None
    notes: Optional[str] = None

class AssignDriverInput(BaseModel):
    driverId: str

class LiveTrackingSnapshotDto(BaseModel):
    drivers: List[DeliveryDriverDto]
    activeOrders: List[DeliveryOrderDto]
    timestamp: str
