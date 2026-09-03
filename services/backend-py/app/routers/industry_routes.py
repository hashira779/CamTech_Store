from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.dependencies import get_current_user, TenantUser
from app.domain.industry_engine import IndustryEngine, INDUSTRY_PRESETS

router = APIRouter(prefix="/industry", tags=["Industry Verticals & Presets (Spec §17-§22, §112)"])

# In-memory tenant store for vertical assets (tables, KDS tickets, pumps)
_TABLES_STORE: Dict[str, List[Dict[str, Any]]] = {}
_KDS_STORE: Dict[str, List[Dict[str, Any]]] = {}
_TENANT_PRESET_MAP: Dict[str, str] = {}

class IndustryConfigDto(BaseModel):
    organizationId: str
    activePreset: str
    availablePresets: List[str]
    features: List[str]

class SetupIndustryInput(BaseModel):
    preset: str  # RETAIL, RESTAURANT, CAFE, FUEL_STATION, PHARMACY, ELECTRONICS, WHOLESALE

class TableDto(BaseModel):
    id: str
    tableNumber: str
    capacity: int
    status: str  # VACANT, OCCUPIED, BILL_PRINTED, RESERVED, CLEANING
    section: Optional[str] = "Main Dining"

class CreateTableInput(BaseModel):
    tableNumber: str
    capacity: int = 4
    section: Optional[str] = "Main Dining"

class KDSTicketDto(BaseModel):
    id: str
    orderNumber: str
    tableNumber: Optional[str] = None
    items: List[Dict[str, Any]]
    status: str  # ORDERED, PREPARING, READY, SERVED, CANCELLED
    elapsedMinutes: int = 0
    createdAt: str

class CreateKDSTicketInput(BaseModel):
    orderNumber: str
    tableNumber: Optional[str] = None
    items: List[Dict[str, Any]]

class FuelReconciliationInput(BaseModel):
    openingMeter: float
    closingMeter: float
    fuelPricePerLiter: float
    tankDipStartLiters: float
    tankDipEndLiters: float
    deliveriesReceivedLiters: Optional[float] = 0.0

class DrugExpiryCheckInput(BaseModel):
    expiryDate: str
    thresholdDays: Optional[int] = 90

class WarrantyCheckInput(BaseModel):
    soldAt: str
    warrantyMonths: int = 12
    serialNumber: Optional[str] = None

@router.get("/config", response_model=IndustryConfigDto)
async def get_industry_config(user: TenantUser = Depends(get_current_user)):
    preset = _TENANT_PRESET_MAP.get(user.organization_id, "RETAIL")
    preset_features = {
        "RETAIL": ["POS", "Inventory", "Barcode Scanner", "Customer Loyalty"],
        "WHOLESALE": ["Credit Terms", "Tiered Pricing", "Pallet Storage", "Bulk Invoicing"],
        "RESTAURANT": ["Table Management", "Kitchen Display KDS", "Recipe BOM", "Split Bills"],
        "CAFE": ["Modifiers", "Quick Add", "Recipe Deductions", "Loyalty Rewards"],
        "FUEL_STATION": ["Pump Meters", "Underground Tanks", "Shift Reconciliation", "Dip Logs"],
        "PHARMACY": ["Prescriptions", "Drug Schedules", "Expiry Alerts", "Dosage Verification"],
        "ELECTRONICS": ["Serial Numbers", "IMEI Lookup", "Warranty Tracking", "Repair Tickets"],
    }
    return IndustryConfigDto(
        organizationId=user.organization_id,
        activePreset=preset,
        availablePresets=INDUSTRY_PRESETS,
        features=preset_features.get(preset, ["POS", "Inventory"])
    )

@router.post("/setup", response_model=IndustryConfigDto)
async def setup_industry_preset(
    inp: SetupIndustryInput,
    user: TenantUser = Depends(get_current_user)
):
    target = inp.preset.upper()
    if target not in INDUSTRY_PRESETS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown industry preset: {target}. Available: {INDUSTRY_PRESETS}"
        )
    _TENANT_PRESET_MAP[user.organization_id] = target
    return await get_industry_config(user)

# ──────────────────────────────────────────────────────────────────────────────
# RESTAURANT & KDS (Spec §17 - §20)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/restaurant/tables", response_model=List[TableDto])
async def list_tables(user: TenantUser = Depends(get_current_user)):
    org_id = user.organization_id
    if org_id not in _TABLES_STORE:
        # Seed default layout
        _TABLES_STORE[org_id] = [
            {"id": "tbl_01", "tableNumber": "T-01", "capacity": 2, "status": "VACANT", "section": "Patio"},
            {"id": "tbl_02", "tableNumber": "T-02", "capacity": 4, "status": "OCCUPIED", "section": "Main Dining"},
            {"id": "tbl_03", "tableNumber": "T-03", "capacity": 6, "status": "VACANT", "section": "Main Dining"},
            {"id": "tbl_04", "tableNumber": "T-04", "capacity": 4, "status": "BILL_PRINTED", "section": "VIP Booth"},
        ]
    return [TableDto(**t) for t in _TABLES_STORE[org_id]]

@router.post("/restaurant/tables", response_model=TableDto)
async def create_table(inp: CreateTableInput, user: TenantUser = Depends(get_current_user)):
    org_id = user.organization_id
    if org_id not in _TABLES_STORE:
        _TABLES_STORE[org_id] = []
    t_id = f"tbl_{len(_TABLES_STORE[org_id]) + 1:02d}"
    data = {
        "id": t_id,
        "tableNumber": inp.tableNumber,
        "capacity": inp.capacity,
        "status": "VACANT",
        "section": inp.section or "Main Dining"
    }
    _TABLES_STORE[org_id].append(data)
    return TableDto(**data)

@router.patch("/restaurant/tables/{table_id}/status", response_model=TableDto)
async def update_table_status(
    table_id: str,
    new_status: str,
    user: TenantUser = Depends(get_current_user)
):
    org_id = user.organization_id
    tables = _TABLES_STORE.get(org_id, [])
    tbl = next((t for t in tables if t["id"] == table_id), None)
    if not tbl:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Table not found")

    if not IndustryEngine.validate_table_transition(tbl["status"], new_status):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transition from {tbl['status']} to {new_status}"
        )
    tbl["status"] = new_status.upper()
    return TableDto(**tbl)

@router.get("/restaurant/kds", response_model=List[KDSTicketDto])
async def list_kds_tickets(user: TenantUser = Depends(get_current_user)):
    org_id = user.organization_id
    if org_id not in _KDS_STORE:
        _KDS_STORE[org_id] = [
            {
                "id": "kds_01",
                "orderNumber": "#ORD-101",
                "tableNumber": "T-02",
                "items": [{"name": "Grilled Salmon", "quantity": 2, "notes": "Medium rare"}],
                "status": "PREPARING",
                "elapsedMinutes": 6,
                "createdAt": "2026-09-03T13:00:00Z"
            },
            {
                "id": "kds_02",
                "orderNumber": "#ORD-102",
                "tableNumber": "T-04",
                "items": [{"name": "Iced Americano", "quantity": 1, "notes": "No sugar"}],
                "status": "ORDERED",
                "elapsedMinutes": 2,
                "createdAt": "2026-09-03T13:04:00Z"
            }
        ]
    return [KDSTicketDto(**k) for k in _KDS_STORE[org_id]]

@router.patch("/restaurant/kds/{ticket_id}/status", response_model=KDSTicketDto)
async def update_kds_status(
    ticket_id: str,
    new_status: str,
    user: TenantUser = Depends(get_current_user)
):
    org_id = user.organization_id
    tickets = _KDS_STORE.get(org_id, [])
    ticket = next((k for k in tickets if k["id"] == ticket_id), None)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="KDS ticket not found")

    if not IndustryEngine.validate_kds_transition(ticket["status"], new_status):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid KDS transition from {ticket['status']} to {new_status}"
        )
    ticket["status"] = new_status.upper()
    return KDSTicketDto(**ticket)

# ──────────────────────────────────────────────────────────────────────────────
# FUEL, PHARMACY & ELECTRONICS CALCULATIONS (Spec §21, §22, §26)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/fuel/reconcile")
async def reconcile_fuel(inp: FuelReconciliationInput, user: TenantUser = Depends(get_current_user)):
    return IndustryEngine.reconcile_fuel_shift(
        opening_meter=inp.openingMeter,
        closing_meter=inp.closingMeter,
        fuel_price_per_liter=inp.fuelPricePerLiter,
        tank_dip_start_liters=inp.tankDipStartLiters,
        tank_dip_end_liters=inp.tankDipEndLiters,
        deliveries_received_liters=inp.deliveriesReceivedLiters or 0.0
    )

@router.post("/pharmacy/check-expiry")
async def check_drug_expiry(inp: DrugExpiryCheckInput, user: TenantUser = Depends(get_current_user)):
    return IndustryEngine.evaluate_drug_expiry_risk(
        expiry_date_str=inp.expiryDate,
        threshold_days=inp.thresholdDays or 90
    )

@router.post("/electronics/check-warranty")
async def check_warranty(inp: WarrantyCheckInput, user: TenantUser = Depends(get_current_user)):
    return IndustryEngine.validate_serial_warranty(
        sold_at_str=inp.soldAt,
        warranty_months=inp.warrantyMonths
    )
