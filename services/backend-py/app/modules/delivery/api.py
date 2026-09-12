from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_optional_user, TenantUser, RequirePermissions, RequireAnyPermission
from .schemas import (
    DeliveryDriverDto, CreateDriverInput, DriverLocationPingInput,
    DeliveryOrderDto, CreateDeliveryOrderInput, UpdateDeliveryStatusInput,
    AssignDriverInput, LiveTrackingSnapshotDto
)
from . import service as svc
from .api_auth import router as auth_router

router = APIRouter(prefix="/delivery", tags=["Delivery & Live Fleet Dispatch"])
router.include_router(auth_router, prefix="/auth")

def resolve_org_id(user: Optional[TenantUser]) -> str:
    """
    Secure tenant scoping (Spec Golden Rule §3):
    If user is authenticated, strictly scope to their token's organization_id.
    Unauthenticated public endpoints are restricted to DEFAULT_ORG_ID.
    """
    if user:
        return user.organization_id
    return settings.DEFAULT_ORG_ID

# Public & Fleet Driver Task Endpoints (Spec §45, §161)
@router.get("/track/{identifier}", response_model=DeliveryOrderDto)
async def track_delivery_order(
    identifier: str,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Real-time Order Tracking Endpoint.
    Allows customers and dispatchers to lookup live delivery status, ETA, and courier telemetry.
    Supports lookup by tracking number (e.g. TRK-2026-1001), delivery order UUID, or sale ID.
    """
    target_org = resolve_org_id(user)
    order = await svc.track_order(db, org_id=target_org, identifier=identifier)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Tracking details not found for '{identifier}'"
        )
    return order

@router.get("/tasks")
async def list_delivery_tasks(
    status: Optional[str] = None,
    search: Optional[str] = None,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Courier App & Driver Dispatch Endpoint for apps/delivery (Port 5004).
    Returns real-time tasks dispatched from customer storefront checkout.
    """
    target_org = resolve_org_id(user)
    orders = await svc.list_orders(db, org_id=target_org, status=status, search=search)
    return {
        "items": [
            {
                "id": o.id,
                "trackingNumber": o.trackingNumber,
                "recipientName": o.recipientName,
                "recipientPhone": o.recipientPhone,
                "destinationAddress": o.deliveryAddress,
                "deliveryAddress": o.deliveryAddress,
                "status": o.status,
                "codAmount": float(o.codAmount or 0.0),
                "paymentMethod": "CASH_ON_DELIVERY" if (o.codAmount and float(o.codAmount) > 0) else "PAID_KHQR",
                "notes": o.notes or "",
                "createdAt": o.createdAt,
                "saleId": o.saleId,
            }
            for o in orders
        ],
        "total": len(orders)
    }

@router.get("/drivers/public", response_model=List[DeliveryDriverDto])
async def list_public_drivers(
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Public Fleet Roster for mobile courier apps.
    Returns live telemetry, vehicle type, and battery status.
    """
    target_org = resolve_org_id(user)
    return await svc.list_drivers(db, org_id=target_org)

@router.post("/orders/public", response_model=DeliveryOrderDto)
@router.post("/tasks", response_model=DeliveryOrderDto)
async def create_public_delivery_order(
    inp: CreateDeliveryOrderInput,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Live Storefront Checkout Dispatch Endpoint.
    When an order is confirmed in apps/store, this immediately dispatches a live task to apps/delivery.
    """
    target_org = resolve_org_id(user)
    return await svc.create_order(db, org_id=target_org, inp=inp)

@router.patch("/tasks/{order_id}/status", response_model=DeliveryOrderDto)
async def update_delivery_task_status(
    order_id: str,
    inp: UpdateDeliveryStatusInput,
    user: Optional[TenantUser] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Allows mobile delivery couriers to update package status (IN_TRANSIT, DELIVERED).
    """
    target_org = resolve_org_id(user)
    driver_id = user.id if (user and ("DELIVERY_DRIVER" in user.roles or hasattr(user, "id"))) else None
    order = await svc.update_order_status(db, org_id=target_org, order_id=order_id, inp=inp, driver_id=driver_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition or order not found: {order_id}"
        )
    return order

@router.get("/orders", response_model=List[DeliveryOrderDto])
async def list_delivery_orders(
    status: Optional[str] = None,
    search: Optional[str] = None,
    user: TenantUser = Depends(RequirePermissions(["delivery:read"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns list of delivery orders with optional status or search filter.
    """
    return await svc.list_orders(
        db,
        org_id=user.organization_id,
        status=status,
        search=search
    )

@router.post("/orders", response_model=DeliveryOrderDto)
async def create_delivery_order(
    inp: CreateDeliveryOrderInput,
    user: TenantUser = Depends(RequirePermissions(["delivery:manage"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a new delivery order, optionally linked to a sales transaction.
    """
    return await svc.create_order(db, org_id=user.organization_id, inp=inp)

@router.get("/orders/{order_id}", response_model=DeliveryOrderDto)
async def get_delivery_order(
    order_id: str,
    user: TenantUser = Depends(RequirePermissions(["delivery:read"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves delivery order details by ID.
    """
    order = await svc.get_order(db, org_id=user.organization_id, order_id=order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery order not found: {order_id}"
        )
    return order

@router.patch("/orders/{order_id}", response_model=DeliveryOrderDto)
@router.patch("/orders/{order_id}/status", response_model=DeliveryOrderDto)
async def update_delivery_status(
    order_id: str,
    inp: UpdateDeliveryStatusInput,
    user: TenantUser = Depends(RequireAnyPermission(["delivery:manage", "delivery:update_own"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Updates the delivery status following state machine rules (DISPATCHED, IN_TRANSIT, DELIVERED).
    """
    driver_id = user.id if ("DELIVERY_DRIVER" in user.roles) else None
    order = await svc.update_order_status(
        db,
        org_id=user.organization_id,
        order_id=order_id,
        inp=inp,
        driver_id=driver_id
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition or order not found: {order_id}"
        )
    return order

@router.post("/orders/{order_id}/assign", response_model=DeliveryOrderDto)
async def assign_driver(
    order_id: str,
    inp: AssignDriverInput,
    user: TenantUser = Depends(RequirePermissions(["delivery:manage"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Assigns a driver to a delivery order and automatically computes initial distance & ETA.
    """
    order = await svc.assign_driver(
        db,
        org_id=user.organization_id,
        order_id=order_id,
        driver_id=inp.driverId
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unable to assign driver {inp.driverId} to order {order_id}"
        )
    return order

@router.get("/drivers", response_model=List[DeliveryDriverDto])
async def list_drivers(
    user: TenantUser = Depends(RequirePermissions(["delivery:read"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns list of fleet drivers with live telemetry, status, and battery levels.
    """
    return await svc.list_drivers(db, org_id=user.organization_id)

@router.post("/drivers", response_model=DeliveryDriverDto)
async def create_driver(
    inp: CreateDriverInput,
    user: TenantUser = Depends(RequirePermissions(["delivery:manage"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Registers a new driver and vehicle in the fleet.
    """
    return await svc.create_driver(db, org_id=user.organization_id, inp=inp)

@router.post("/drivers/{driver_id}/location", response_model=DeliveryDriverDto)
async def ping_driver_location(
    driver_id: str,
    inp: DriverLocationPingInput,
    user: TenantUser = Depends(RequireAnyPermission(["delivery:manage", "delivery:update_own"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Receives live GPS telemetry ping from mobile driver app or GPS tracker beacon.
    """
    inp.driverId = driver_id
    driver = await svc.ping_driver_location(db, org_id=user.organization_id, inp=inp)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Driver not found: {driver_id}"
        )
    return driver

@router.get("/live-tracking", response_model=LiveTrackingSnapshotDto)
async def get_live_tracking_snapshot(
    user: TenantUser = Depends(RequirePermissions(["delivery:read"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns real-time snapshot of all active drivers and in-transit orders for the live map.
    """
    return await svc.get_live_tracking_snapshot(db, org_id=user.organization_id)
