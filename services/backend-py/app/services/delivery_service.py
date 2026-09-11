"""
Database-backed Delivery & Fleet Dispatch Service (Spec §45).
All operations query/mutate the delivery_orders and delivery_drivers tables.
No in-memory state, no mock data, no seed data.
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.datetime_utils import utc_now
from app.modules.delivery.models import DeliveryDriver, DeliveryOrder
from app.domain.delivery_engine import DeliveryEngine
from app.schemas.dto import (
    DeliveryDriverDto, CreateDriverInput, DriverLocationPingInput,
    DeliveryOrderDto, CreateDeliveryOrderInput, UpdateDeliveryStatusInput,
    LiveTrackingSnapshotDto,
)


def _driver_to_dto(drv: DeliveryDriver, active_count: int = 0) -> DeliveryDriverDto:
    """Map a DeliveryDriver ORM instance to its Pydantic DTO."""
    return DeliveryDriverDto(
        id=drv.id,
        organizationId=drv.organization_id,
        name=drv.name,
        phone=drv.phone,
        vehicleType=drv.vehicle_type,
        licensePlate=drv.license_plate,
        status=drv.status,
        currentLat=drv.current_lat,
        currentLng=drv.current_lng,
        heading=drv.heading,
        batteryLevel=drv.battery_level,
        activeOrdersCount=active_count,
        lastPingAt=drv.last_ping_at.isoformat() if drv.last_ping_at else None,
        authStatus=drv.auth_status,
        telegramUserId=drv.telegram_user_id,
    )


def _order_to_dto(
    order: DeliveryOrder,
    driver: Optional[DeliveryDriver] = None,
) -> DeliveryOrderDto:
    """Map a DeliveryOrder ORM instance to its Pydantic DTO, enriching with driver info."""
    return DeliveryOrderDto(
        id=order.id,
        organizationId=order.organization_id,
        trackingNumber=order.tracking_number,
        saleId=order.sale_id,
        status=order.status,
        recipientName=order.recipient_name,
        recipientPhone=order.recipient_phone,
        deliveryAddress=order.delivery_address,
        destLat=order.dest_lat,
        destLng=order.dest_lng,
        driverId=order.driver_id,
        driverName=driver.name if driver else None,
        driverPhone=driver.phone if driver else None,
        driverVehicle=driver.vehicle_type if driver else None,
        codAmount=float(order.cod_amount or 0),
        deliveryFee=float(order.delivery_fee or 0),
        distanceKm=order.distance_km,
        etaMinutes=order.eta_minutes,
        proofOfDelivery=order.proof_of_delivery,
        notes=order.notes,
        createdAt=order.created_at.isoformat() if order.created_at else datetime.now(timezone.utc).isoformat(),
        dispatchedAt=order.dispatched_at.isoformat() if order.dispatched_at else None,
        deliveredAt=order.delivered_at.isoformat() if order.delivered_at else None,
    )


# ---------------------------------------------------------------------------
# Driver operations
# ---------------------------------------------------------------------------

async def list_drivers(db: AsyncSession, org_id: str) -> List[DeliveryDriverDto]:
    """List all drivers for an organization with their active order counts."""
    # Subquery: count active orders per driver
    active_count_sq = (
        select(
            DeliveryOrder.driver_id,
            func.count(DeliveryOrder.id).label("cnt"),
        )
        .where(
            DeliveryOrder.organization_id == org_id,
            DeliveryOrder.status.in_(["PENDING", "DISPATCHED", "IN_TRANSIT"]),
        )
        .group_by(DeliveryOrder.driver_id)
        .subquery()
    )

    result = await db.execute(
        select(DeliveryDriver, active_count_sq.c.cnt)
        .outerjoin(active_count_sq, DeliveryDriver.id == active_count_sq.c.driver_id)
        .where(DeliveryDriver.organization_id == org_id, DeliveryDriver.is_active == True)
        .order_by(DeliveryDriver.created_at.desc())
    )
    rows = result.all()
    return [_driver_to_dto(drv, int(cnt or 0)) for drv, cnt in rows]


async def create_driver(db: AsyncSession, org_id: str, inp: CreateDriverInput) -> DeliveryDriverDto:
    """Register a new fleet driver."""
    drv = DeliveryDriver(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        name=inp.name,
        phone=inp.phone,
        vehicle_type=inp.vehicleType.upper(),
        license_plate=inp.licensePlate,
        status="IDLE",
        current_lat=inp.initialLat or 11.5564,
        current_lng=inp.initialLng or 104.9282,
        heading=0.0,
        battery_level=100,
        is_active=True,
        last_ping_at=utc_now(),
    )
    db.add(drv)
    await db.commit()
    await db.refresh(drv)
    return _driver_to_dto(drv, 0)


async def ping_driver_location(
    db: AsyncSession, org_id: str, inp: DriverLocationPingInput
) -> Optional[DeliveryDriverDto]:
    """Process a GPS heartbeat from a driver's mobile device."""
    result = await db.execute(
        select(DeliveryDriver).where(
            DeliveryDriver.id == inp.driverId,
            DeliveryDriver.organization_id == org_id,
        )
    )
    drv = result.scalar_one_or_none()
    if not drv:
        return None

    old_lat, old_lng = drv.current_lat, drv.current_lng

    # Compute heading
    if inp.heading is not None:
        new_heading = inp.heading
    elif old_lat != inp.latitude or old_lng != inp.longitude:
        new_heading = DeliveryEngine.calculate_bearing(old_lat, old_lng, inp.latitude, inp.longitude)
    else:
        new_heading = drv.heading or 0.0

    drv.current_lat = round(inp.latitude, 6)
    drv.current_lng = round(inp.longitude, 6)
    drv.heading = new_heading
    if inp.batteryLevel is not None:
        drv.battery_level = inp.batteryLevel
    drv.last_ping_at = utc_now()

    # Update ETA/distance on active orders assigned to this driver
    orders_result = await db.execute(
        select(DeliveryOrder).where(
            DeliveryOrder.driver_id == inp.driverId,
            DeliveryOrder.organization_id == org_id,
            DeliveryOrder.status.in_(["DISPATCHED", "IN_TRANSIT"]),
        )
    )
    for order in orders_result.scalars().all():
        dist = DeliveryEngine.calculate_distance_km(
            inp.latitude, inp.longitude, order.dest_lat, order.dest_lng
        )
        eta = DeliveryEngine.calculate_eta_minutes(dist, drv.vehicle_type)
        order.distance_km = dist
        order.eta_minutes = eta

    await db.commit()
    await db.refresh(drv)
    return _driver_to_dto(drv)


# ---------------------------------------------------------------------------
# Order operations
# ---------------------------------------------------------------------------

async def _load_driver(db: AsyncSession, driver_id: Optional[str]) -> Optional[DeliveryDriver]:
    """Helper to load a driver by ID."""
    if not driver_id:
        return None
    result = await db.execute(select(DeliveryDriver).where(DeliveryDriver.id == driver_id))
    return result.scalar_one_or_none()


async def list_orders(
    db: AsyncSession,
    org_id: str,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 200,
    offset: int = 0,
) -> List[DeliveryOrderDto]:
    """List delivery orders with optional status/search filters and bounded pagination."""
    stmt = (
        select(DeliveryOrder, DeliveryDriver)
        .outerjoin(DeliveryDriver, DeliveryOrder.driver_id == DeliveryDriver.id)
        .where(DeliveryOrder.organization_id == org_id)
    )
    if status:
        stmt = stmt.where(DeliveryOrder.status == status.upper())
    if search:
        pattern = f"%{search.lower()}%"
        stmt = stmt.where(
            func.lower(DeliveryOrder.tracking_number).like(pattern)
            | func.lower(DeliveryOrder.recipient_name).like(pattern)
            | func.lower(DeliveryOrder.recipient_phone).like(pattern)
            | func.lower(DeliveryOrder.delivery_address).like(pattern)
        )
    safe_limit = min(max(limit, 1), 500)
    stmt = stmt.order_by(DeliveryOrder.created_at.desc()).limit(safe_limit).offset(max(offset, 0))

    result = await db.execute(stmt)
    rows = result.all()
    return [_order_to_dto(order, driver) for order, driver in rows]


async def get_order(db: AsyncSession, org_id: str, order_id: str) -> Optional[DeliveryOrderDto]:
    """Get a single delivery order by ID."""
    result = await db.execute(
        select(DeliveryOrder, DeliveryDriver)
        .outerjoin(DeliveryDriver, DeliveryOrder.driver_id == DeliveryDriver.id)
        .where(DeliveryOrder.id == order_id, DeliveryOrder.organization_id == org_id)
    )
    row = result.first()
    if not row:
        return None
    order, driver = row
    return _order_to_dto(order, driver)


async def create_order(
    db: AsyncSession, org_id: str, inp: CreateDeliveryOrderInput
) -> DeliveryOrderDto:
    """Create a new delivery order, optionally pre-assigning a driver."""
    now = utc_now()

    # Generate sequential tracking number
    count_result = await db.execute(
        select(func.count(DeliveryOrder.id)).where(DeliveryOrder.organization_id == org_id)
    )
    seq = (count_result.scalar() or 0) + 1001
    tracking_num = DeliveryEngine.generate_tracking_number(seq)

    dest_lat = inp.destLat if inp.destLat is not None else 11.5564
    dest_lng = inp.destLng if inp.destLng is not None else 104.9282

    recipient_name = (inp.recipientName or inp.customerName or "Valued Customer").strip()
    recipient_phone = (inp.recipientPhone or inp.customerPhone or "N/A").strip()

    order = DeliveryOrder(
        id=str(uuid.uuid4()),
        organization_id=org_id,
        tracking_number=tracking_num,
        sale_id=inp.saleId,
        status="PENDING",
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        delivery_address=inp.deliveryAddress,
        dest_lat=dest_lat,
        dest_lng=dest_lng,
        driver_id=None,
        cod_amount=inp.codAmount or 0,
        delivery_fee=inp.deliveryFee or 2.50,
        notes=inp.notes,
        created_at=now,
    )

    driver = None
    if inp.driverId:
        driver = await _load_driver(db, inp.driverId)
        if driver:
            order.driver_id = driver.id
            order.status = "DISPATCHED"
            order.dispatched_at = now
            driver.status = "EN_ROUTE"

            dist = DeliveryEngine.calculate_distance_km(
                driver.current_lat, driver.current_lng, dest_lat, dest_lng
            )
            order.distance_km = dist
            order.eta_minutes = DeliveryEngine.calculate_eta_minutes(dist, driver.vehicle_type)

    db.add(order)
    await db.commit()
    await db.refresh(order)
    if driver:
        await db.refresh(driver)
    return _order_to_dto(order, driver)


async def assign_driver(
    db: AsyncSession, org_id: str, order_id: str, driver_id: str
) -> Optional[DeliveryOrderDto]:
    """Assign a driver to an order and compute initial distance & ETA."""
    result = await db.execute(
        select(DeliveryOrder).where(
            DeliveryOrder.id == order_id, DeliveryOrder.organization_id == org_id
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        return None

    drv_result = await db.execute(
        select(DeliveryDriver).where(
            DeliveryDriver.id == driver_id, DeliveryDriver.organization_id == org_id
        )
    )
    driver = drv_result.scalar_one_or_none()
    if not driver:
        return None

    order.driver_id = driver.id
    order.status = "DISPATCHED"
    order.dispatched_at = utc_now()

    driver.status = "EN_ROUTE"

    dist = DeliveryEngine.calculate_distance_km(
        driver.current_lat, driver.current_lng, order.dest_lat, order.dest_lng
    )
    order.distance_km = dist
    order.eta_minutes = DeliveryEngine.calculate_eta_minutes(dist, driver.vehicle_type)

    await db.commit()
    await db.refresh(order)
    await db.refresh(driver)
    return _order_to_dto(order, driver)


async def update_order_status(
    db: AsyncSession, org_id: str, order_id: str, inp: UpdateDeliveryStatusInput
) -> Optional[DeliveryOrderDto]:
    """Update delivery status following state machine rules."""
    result = await db.execute(
        select(DeliveryOrder).where(
            DeliveryOrder.id == order_id, DeliveryOrder.organization_id == org_id
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        return None

    old_status = order.status
    new_status = inp.status.upper()

    # Flexible courier workflow shortcuts
    if old_status == "PENDING" and new_status in ("IN_TRANSIT", "DELIVERED"):
        order.status = "DISPATCHED"
        old_status = "DISPATCHED"
    if old_status == "DISPATCHED" and new_status == "DELIVERED":
        order.status = "IN_TRANSIT"
        old_status = "IN_TRANSIT"

    if not DeliveryEngine.validate_status_transition(old_status, new_status):
        return None

    order.status = new_status
    if inp.proofOfDelivery:
        order.proof_of_delivery = inp.proofOfDelivery
    if inp.notes:
        order.notes = inp.notes

    if new_status == "DELIVERED":
        order.delivered_at = utc_now()
        # Set driver back to IDLE if they have no other active orders
        if order.driver_id:
            active_count_result = await db.execute(
                select(func.count(DeliveryOrder.id)).where(
                    DeliveryOrder.driver_id == order.driver_id,
                    DeliveryOrder.organization_id == org_id,
                    DeliveryOrder.status.in_(["DISPATCHED", "IN_TRANSIT"]),
                    DeliveryOrder.id != order_id,
                )
            )
            remaining = active_count_result.scalar() or 0
            if remaining == 0:
                drv_result = await db.execute(
                    select(DeliveryDriver).where(DeliveryDriver.id == order.driver_id)
                )
                driver_obj = drv_result.scalar_one_or_none()
                if driver_obj:
                    driver_obj.status = "IDLE"

    await db.commit()
    await db.refresh(order)

    driver = await _load_driver(db, order.driver_id)
    return _order_to_dto(order, driver)


async def get_live_tracking_snapshot(
    db: AsyncSession, org_id: str
) -> LiveTrackingSnapshotDto:
    """Return real-time snapshot of all active drivers and in-transit orders."""
    drivers = await list_drivers(db, org_id)

    orders_result = await db.execute(
        select(DeliveryOrder, DeliveryDriver)
        .outerjoin(DeliveryDriver, DeliveryOrder.driver_id == DeliveryDriver.id)
        .where(
            DeliveryOrder.organization_id == org_id,
            DeliveryOrder.status.in_(["PENDING", "DISPATCHED", "IN_TRANSIT"]),
        )
        .order_by(DeliveryOrder.created_at.desc())
    )
    active_orders = [_order_to_dto(o, d) for o, d in orders_result.all()]

    return LiveTrackingSnapshotDto(
        drivers=drivers,
        activeOrders=active_orders,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
