from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.dependencies import get_current_user, TenantUser
from app.schemas.dto import (
    DeliveryDriverDto, CreateDriverInput, DriverLocationPingInput,
    DeliveryOrderDto, CreateDeliveryOrderInput, UpdateDeliveryStatusInput,
    AssignDriverInput, LiveTrackingSnapshotDto
)
from app.services.delivery_service import delivery_service

router = APIRouter(prefix="/delivery", tags=["Delivery & Live Fleet Dispatch"])

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
