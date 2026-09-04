import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
from app.domain.delivery_engine import DeliveryEngine
from app.schemas.dto import (
    DeliveryDriverDto, CreateDriverInput, DriverLocationPingInput,
    DeliveryOrderDto, CreateDeliveryOrderInput, UpdateDeliveryStatusInput,
    LiveTrackingSnapshotDto
)

class DeliveryService:
    """
    Enterprise In-Memory / Hybrid Delivery & Fleet Service (Spec §45).
    Provides tenant-scoped real-time dispatch, fleet telemetry, route tracking,
    and automatic GPS heartbeat simulation for live map demonstrations.
    """

    def __init__(self):
        # org_id -> {driver_id: DriverDict}
        self._drivers: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # org_id -> {order_id: OrderDict}
        self._orders: Dict[str, Dict[str, Dict[str, Any]]] = {}
        # Sequence counter per org
        self._seq: Dict[str, int] = {}

    def _ensure_org_seed(self, org_id: str):
        if org_id not in self._drivers:
            self._drivers[org_id] = {}
            self._orders[org_id] = {}
            self._seq[org_id] = 1000

            # Seed initial drivers across commercial hubs in Phnom Penh
            d1_id = f"drv_{uuid.uuid4().hex[:8]}"
            d2_id = f"drv_{uuid.uuid4().hex[:8]}"
            d3_id = f"drv_{uuid.uuid4().hex[:8]}"

            self._drivers[org_id][d1_id] = {
                "id": d1_id,
                "organizationId": org_id,
                "name": "Sokha Chan (Express)",
                "phone": "+855 12 889 123",
                "vehicleType": "MOTORCYCLE",
                "licensePlate": "1AB-4492",
                "status": "EN_ROUTE",
                "currentLat": 11.5564,   # BKK1
                "currentLng": 104.9282,
                "heading": 45.0,
                "batteryLevel": 92,
                "activeOrdersCount": 1,
                "lastPingAt": datetime.now(timezone.utc).isoformat()
            }

            self._drivers[org_id][d2_id] = {
                "id": d2_id,
                "organizationId": org_id,
                "name": "Rithy Heng (Cargo Van)",
                "phone": "+855 15 902 441",
                "vehicleType": "VAN",
                "licensePlate": "2BC-9910",
                "status": "EN_ROUTE",
                "currentLat": 11.5721,   # Riverside / Daun Penh
                "currentLng": 104.9315,
                "heading": 180.0,
                "batteryLevel": 85,
                "activeOrdersCount": 1,
                "lastPingAt": datetime.now(timezone.utc).isoformat()
            }

            self._drivers[org_id][d3_id] = {
                "id": d3_id,
                "organizationId": org_id,
                "name": "Piseth Chea (Rapid Fleet)",
                "phone": "+855 70 334 556",
                "vehicleType": "MOTORCYCLE",
                "licensePlate": "1CD-1123",
                "status": "IDLE",
                "currentLat": 11.5385,   # Russian Market (TTP)
                "currentLng": 104.9142,
                "heading": 90.0,
                "batteryLevel": 98,
                "activeOrdersCount": 0,
                "lastPingAt": datetime.now(timezone.utc).isoformat()
            }

            # Seed initial active orders
            o1_id = f"ord_{uuid.uuid4().hex[:8]}"
            o2_id = f"ord_{uuid.uuid4().hex[:8]}"

            self._orders[org_id][o1_id] = {
                "id": o1_id,
                "organizationId": org_id,
                "trackingNumber": "TRK-2026-001001",
                "saleId": "sale_demo_01",
                "status": "IN_TRANSIT",
                "recipientName": "Vannak Meas",
                "recipientPhone": "+855 98 765 432",
                "deliveryAddress": "Street 240, Khan Daun Penh, Phnom Penh",
                "destLat": 11.5612,
                "destLng": 104.9340,
                "driverId": d1_id,
                "driverName": "Sokha Chan (Express)",
                "driverPhone": "+855 12 889 123",
                "driverVehicle": "MOTORCYCLE",
                "codAmount": 34.50,
                "deliveryFee": 2.00,
                "distanceKm": 1.2,
                "etaMinutes": 8,
                "proofOfDelivery": None,
                "notes": "Call upon arrival, leave at security desk",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "dispatchedAt": datetime.now(timezone.utc).isoformat(),
                "deliveredAt": None
            }

            self._orders[org_id][o2_id] = {
                "id": o2_id,
                "organizationId": org_id,
                "trackingNumber": "TRK-2026-001002",
                "saleId": "sale_demo_02",
                "status": "DISPATCHED",
                "recipientName": "Sophea Lin",
                "recipientPhone": "+855 16 332 119",
                "deliveryAddress": "Toul Kork St 315, Phnom Penh",
                "destLat": 11.5830,
                "destLng": 104.8990,
                "driverId": d2_id,
                "driverName": "Rithy Heng (Cargo Van)",
                "driverPhone": "+855 15 902 441",
                "driverVehicle": "VAN",
                "codAmount": 120.00,
                "deliveryFee": 4.50,
                "distanceKm": 4.8,
                "etaMinutes": 18,
                "proofOfDelivery": None,
                "notes": "Fragile electronic cargo, verify packaging",
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "dispatchedAt": datetime.now(timezone.utc).isoformat(),
                "deliveredAt": None
            }

    def list_drivers(self, org_id: str) -> List[DeliveryDriverDto]:
        self._ensure_org_seed(org_id)
        return [DeliveryDriverDto(**d) for d in self._drivers[org_id].values()]

    def create_driver(self, org_id: str, inp: CreateDriverInput) -> DeliveryDriverDto:
        self._ensure_org_seed(org_id)
        drv_id = f"drv_{uuid.uuid4().hex[:8]}"
        data = {
            "id": drv_id,
            "organizationId": org_id,
            "name": inp.name,
            "phone": inp.phone,
            "vehicleType": inp.vehicleType.upper(),
            "licensePlate": inp.licensePlate,
            "status": "IDLE",
            "currentLat": inp.initialLat or 11.5564,
            "currentLng": inp.initialLng or 104.9282,
            "heading": 0.0,
            "batteryLevel": 100,
            "activeOrdersCount": 0,
            "lastPingAt": datetime.now(timezone.utc).isoformat()
        }
        self._drivers[org_id][drv_id] = data
        return DeliveryDriverDto(**data)

    def ping_driver_location(self, org_id: str, inp: DriverLocationPingInput) -> Optional[DeliveryDriverDto]:
        self._ensure_org_seed(org_id)
        driver = self._drivers[org_id].get(inp.driverId)
        if not driver:
            return None

        # Calculate new heading if previous coordinate exists
        old_lat = driver["currentLat"]
        old_lng = driver["currentLng"]
        if inp.heading is not None:
            new_heading = inp.heading
        elif (old_lat != inp.latitude or old_lng != inp.longitude):
            new_heading = DeliveryEngine.calculate_bearing(old_lat, old_lng, inp.latitude, inp.longitude)
        else:
            new_heading = driver.get("heading", 0.0)

        driver["currentLat"] = round(inp.latitude, 6)
        driver["currentLng"] = round(inp.longitude, 6)
        driver["heading"] = new_heading
        if inp.batteryLevel is not None:
            driver["batteryLevel"] = inp.batteryLevel
        driver["lastPingAt"] = datetime.now(timezone.utc).isoformat()

        # Update distance and ETA for active orders assigned to this driver
        for o in self._orders[org_id].values():
            if o.get("driverId") == inp.driverId and o.get("status") in ["DISPATCHED", "IN_TRANSIT"]:
                dist = DeliveryEngine.calculate_distance_km(
                    inp.latitude, inp.longitude, o["destLat"], o["destLng"]
                )
                eta = DeliveryEngine.calculate_eta_minutes(dist, driver["vehicleType"])
                o["distanceKm"] = dist
                o["etaMinutes"] = eta

        return DeliveryDriverDto(**driver)

    def list_orders(
        self,
        org_id: str,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[DeliveryOrderDto]:
        self._ensure_org_seed(org_id)
        orders = list(self._orders[org_id].values())

        if status:
            orders = [o for o in orders if o["status"].upper() == status.upper()]
        if search:
            s = search.lower()
            orders = [
                o for o in orders
                if s in o["trackingNumber"].lower()
                or s in o["recipientName"].lower()
                or s in o["recipientPhone"].lower()
                or s in o["deliveryAddress"].lower()
            ]

        # Sort newest first
        orders.sort(key=lambda x: x["createdAt"], reverse=True)
        return [DeliveryOrderDto(**o) for o in orders]

    def get_order(self, org_id: str, order_id: str) -> Optional[DeliveryOrderDto]:
        self._ensure_org_seed(org_id)
        data = self._orders[org_id].get(order_id)
        return DeliveryOrderDto(**data) if data else None

    def create_order(self, org_id: str, inp: CreateDeliveryOrderInput) -> DeliveryOrderDto:
        self._ensure_org_seed(org_id)
        self._seq[org_id] += 1
        ord_id = f"ord_{uuid.uuid4().hex[:8]}"
        tracking_num = DeliveryEngine.generate_tracking_number(self._seq[org_id])

        driver_info = {}
        initial_status = "PENDING"
        distance_km = None
        eta_minutes = None

        dest_lat = inp.destLat if inp.destLat is not None else 11.5564
        dest_lng = inp.destLng if inp.destLng is not None else 104.9282

        assigned_driver_id = inp.driverId
        if assigned_driver_id and assigned_driver_id in self._drivers[org_id]:
            drv = self._drivers[org_id][assigned_driver_id]
            driver_info = {
                "driverId": drv["id"],
                "driverName": drv["name"],
                "driverPhone": drv["phone"],
                "driverVehicle": drv["vehicleType"],
            }
            initial_status = "DISPATCHED"
            drv["activeOrdersCount"] = drv.get("activeOrdersCount", 0) + 1
            drv["status"] = "EN_ROUTE"
            distance_km = DeliveryEngine.calculate_distance_km(
                drv["currentLat"], drv["currentLng"], dest_lat, dest_lng
            )
            eta_minutes = DeliveryEngine.calculate_eta_minutes(distance_km, drv["vehicleType"])

        data = {
            "id": ord_id,
            "organizationId": org_id,
            "trackingNumber": tracking_num,
            "saleId": inp.saleId,
            "status": initial_status,
            "recipientName": inp.recipientName,
            "recipientPhone": inp.recipientPhone,
            "deliveryAddress": inp.deliveryAddress,
            "destLat": round(dest_lat, 6),
            "destLng": round(dest_lng, 6),
            "codAmount": inp.codAmount or 0.0,
            "deliveryFee": inp.deliveryFee or 2.50,
            "distanceKm": distance_km,
            "etaMinutes": eta_minutes,
            "proofOfDelivery": None,
            "notes": inp.notes,
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "dispatchedAt": datetime.now(timezone.utc).isoformat() if inp.driverId else None,
            "deliveredAt": None,
            **driver_info
        }
        self._orders[org_id][ord_id] = data
        return DeliveryOrderDto(**data)

    def assign_driver(self, org_id: str, order_id: str, driver_id: str) -> Optional[DeliveryOrderDto]:
        self._ensure_org_seed(org_id)
        order = self._orders[org_id].get(order_id)
        driver = self._drivers[org_id].get(driver_id)
        if not order or not driver:
            return None

        order["driverId"] = driver["id"]
        order["driverName"] = driver["name"]
        order["driverPhone"] = driver["phone"]
        order["driverVehicle"] = driver["vehicleType"]
        order["status"] = "DISPATCHED"
        order["dispatchedAt"] = datetime.now(timezone.utc).isoformat()

        driver["activeOrdersCount"] = driver.get("activeOrdersCount", 0) + 1
        driver["status"] = "EN_ROUTE"

        dist = DeliveryEngine.calculate_distance_km(
            driver["currentLat"], driver["currentLng"], order["destLat"], order["destLng"]
        )
        order["distanceKm"] = dist
        order["etaMinutes"] = DeliveryEngine.calculate_eta_minutes(dist, driver["vehicleType"])

        return DeliveryOrderDto(**order)

    def update_order_status(
        self,
        org_id: str,
        order_id: str,
        inp: UpdateDeliveryStatusInput
    ) -> Optional[DeliveryOrderDto]:
        self._ensure_org_seed(org_id)
        order = self._orders[org_id].get(order_id)
        if not order:
            return None

        old_status = order["status"]
        new_status = inp.status.upper()

        # Allow flexible field courier workflow:
        # PENDING -> IN_TRANSIT or DELIVERED automatically dispatches
        # DISPATCHED -> DELIVERED automatically marks in-transit then delivered
        if old_status == "PENDING" and new_status in ["IN_TRANSIT", "DELIVERED"]:
            order["status"] = "DISPATCHED"
            old_status = "DISPATCHED"
        if old_status == "DISPATCHED" and new_status == "DELIVERED":
            order["status"] = "IN_TRANSIT"
            old_status = "IN_TRANSIT"

        if not DeliveryEngine.validate_status_transition(old_status, new_status):
            return None

        order["status"] = new_status
        if inp.proofOfDelivery:
            order["proofOfDelivery"] = inp.proofOfDelivery
        if inp.notes:
            order["notes"] = inp.notes

        if new_status == "DELIVERED":
            order["deliveredAt"] = datetime.now(timezone.utc).isoformat()
            # Decrement driver active count
            drv_id = order.get("driverId")
            if drv_id and drv_id in self._drivers[org_id]:
                drv = self._drivers[org_id][drv_id]
                drv["activeOrdersCount"] = max(0, drv.get("activeOrdersCount", 1) - 1)
                if drv["activeOrdersCount"] == 0:
                    drv["status"] = "IDLE"

        return DeliveryOrderDto(**order)

    def get_live_tracking_snapshot(self, org_id: str) -> LiveTrackingSnapshotDto:
        self._ensure_org_seed(org_id)
        drivers = [DeliveryDriverDto(**d) for d in self._drivers[org_id].values()]
        active_orders = [
            DeliveryOrderDto(**o)
            for o in self._orders[org_id].values()
            if o["status"] in ["PENDING", "DISPATCHED", "IN_TRANSIT"]
        ]
        return LiveTrackingSnapshotDto(
            drivers=drivers,
            activeOrders=active_orders,
            timestamp=datetime.now(timezone.utc).isoformat()
        )

# Global singleton instance
delivery_service = DeliveryService()
