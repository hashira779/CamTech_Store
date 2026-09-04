from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header, Query
from app.core.config import settings
from app.core.dependencies import get_current_user, get_optional_user, TenantUser
from app.schemas.dto import (
    DeliveryDriverDto, CreateDriverInput, DriverLocationPingInput,
    DeliveryOrderDto, CreateDeliveryOrderInput, UpdateDeliveryStatusInput,
    AssignDriverInput, LiveTrackingSnapshotDto
)
from app.services.delivery_service import delivery_service

router = APIRouter(prefix="/delivery", tags=["Delivery & Live Fleet Dispatch"])

def resolve_org_id(user: Optional[TenantUser]) -> str:
    """
    Secure tenant scoping (Spec Golden Rule §3):
    If user is authenticated, strictly scope to their token's organization_id.
    Unauthenticated public endpoints are restricted to DEFAULT_ORG_ID.
    Arbitrary user-provided org headers/queries are never trusted.
    """
    if user:
        return user.organization_id
    return settings.DEFAULT_ORG_ID

# Public & Fleet Driver Task Endpoints (Spec §45, §161)
@router.get("/tasks")
async def list_delivery_tasks(
    status: Optional[str] = None,
    search: Optional[str] = None,
    user: Optional[TenantUser] = Depends(get_optional_user)
):
    """
    Courier App & Driver Dispatch Endpoint for apps/delivery (Port 5004).
    Returns real-time tasks dispatched from customer storefront checkout.
    """
    target_org = resolve_org_id(user)
    orders = delivery_service.list_orders(org_id=target_org, status=status, search=search)
    return {
        "items": [
            {
                "id": o.id,
                "trackingNumber": o.trackingNumber,
                "recipientName": o.recipientName,
                "recipientPhone": o.recipientPhone,
                "destinationAddress": o.deliveryAddress,
                "status": o.status,
                "codAmount": float(o.codAmount or 0.0),
                "paymentMethod": "CASH_ON_DELIVERY" if (o.codAmount and float(o.codAmount) > 0) else "PAID_KHQR",
                "notes": o.notes or ""
            }
            for o in orders
        ],
        "total": len(orders)
    }

@router.get("/drivers/public", response_model=List[DeliveryDriverDto])
async def list_public_drivers(
    user: Optional[TenantUser] = Depends(get_optional_user)
):
    """
    Public Fleet Roster for mobile courier apps.
    Returns live telemetry, vehicle type, and battery status.
    """
    target_org = resolve_org_id(user)
    return delivery_service.list_drivers(org_id=target_org)

@router.post("/orders/public", response_model=DeliveryOrderDto)
@router.post("/tasks", response_model=DeliveryOrderDto)
async def create_public_delivery_order(
    inp: CreateDeliveryOrderInput,
    user: Optional[TenantUser] = Depends(get_optional_user)
):
    """
    Live Storefront Checkout Dispatch Endpoint.
    When an order is confirmed in apps/store, this immediately dispatches a live task to apps/delivery.
    """
    target_org = resolve_org_id(user)
    return delivery_service.create_order(org_id=target_org, inp=inp)

@router.patch("/tasks/{order_id}/status", response_model=DeliveryOrderDto)
async def update_delivery_task_status(
    order_id: str,
    inp: UpdateDeliveryStatusInput,
    user: Optional[TenantUser] = Depends(get_optional_user)
):
    """
    Allows mobile delivery couriers to update package status (IN_TRANSIT, DELIVERED).
    """
    target_org = resolve_org_id(user)
    order = delivery_service.update_order_status(org_id=target_org, order_id=order_id, inp=inp)
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
    user: TenantUser = Depends(get_current_user)
):
    """
    Returns list of delivery orders with optional status or search filter.
    """
    return delivery_service.list_orders(
        org_id=user.organization_id,
        status=status,
        search=search
    )

@router.post("/orders", response_model=DeliveryOrderDto)
async def create_delivery_order(
    inp: CreateDeliveryOrderInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Creates a new delivery order, optionally linked to a sales transaction.
    """
    return delivery_service.create_order(org_id=user.organization_id, inp=inp)

@router.get("/orders/{order_id}", response_model=DeliveryOrderDto)
async def get_delivery_order(
    order_id: str,
    user: TenantUser = Depends(get_current_user)
):
    """
    Retrieves delivery order details by ID.
    """
    order = delivery_service.get_order(org_id=user.organization_id, order_id=order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Delivery order not found: {order_id}"
        )
    return order

@router.patch("/orders/{order_id}/status", response_model=DeliveryOrderDto)
async def update_delivery_status(
    order_id: str,
    inp: UpdateDeliveryStatusInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Updates the delivery status following state machine rules (DISPATCHED, IN_TRANSIT, DELIVERED).
    """
    order = delivery_service.update_order_status(
        org_id=user.organization_id,
        order_id=order_id,
        inp=inp
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
    user: TenantUser = Depends(get_current_user)
):
    """
    Assigns a driver to a delivery order and automatically computes initial distance & ETA.
    """
    order = delivery_service.assign_driver(
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
    user: TenantUser = Depends(get_current_user)
):
    """
    Returns list of fleet drivers with live telemetry, status, and battery levels.
    """
    return delivery_service.list_drivers(org_id=user.organization_id)

@router.post("/drivers", response_model=DeliveryDriverDto)
async def create_driver(
    inp: CreateDriverInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Registers a new driver and vehicle in the fleet.
    """
    return delivery_service.create_driver(org_id=user.organization_id, inp=inp)

@router.post("/drivers/{driver_id}/location", response_model=DeliveryDriverDto)
async def ping_driver_location(
    driver_id: str,
    inp: DriverLocationPingInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Receives live GPS telemetry ping from mobile driver app or GPS tracker beacon.
    """
    inp.driverId = driver_id
    driver = delivery_service.ping_driver_location(org_id=user.organization_id, inp=inp)
    if not driver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Driver not found: {driver_id}"
        )
    return driver

@router.get("/live-tracking", response_model=LiveTrackingSnapshotDto)
async def get_live_tracking_snapshot(
    user: TenantUser = Depends(get_current_user)
):
    """
    Returns real-time snapshot of all active drivers and in-transit orders for the live map.
    """
    return delivery_service.get_live_tracking_snapshot(org_id=user.organization_id)

