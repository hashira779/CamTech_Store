from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query, HTTPException, status
from app.core.dependencies import get_current_user, TenantUser

router = APIRouter(prefix="/apps", tags=["Multi-Domain / Multi-Subdomain Architecture (Spec §228-§258)"])

APP_REGISTRY_DATA: Dict[str, Dict[str, Any]] = {
    "store": {
        "id": "store",
        "name": "CamTech Online Store",
        "subdomain": "store",
        "defaultDomain": "store.camtech.cam",
        "purpose": "Public customer product discovery, shopping cart, and Bakong KHQR checkout.",
        "audience": ["CUSTOMER", "PUBLIC"],
        "allowedRoles": ["*"],
        "defaultRoute": "/shop",
        "modules": ["catalog", "cart", "checkout", "orders", "tracking"],
        "features": ["khqr_pay", "guest_checkout", "category_filters"]
    },
    "cashier": {
        "id": "cashier",
        "name": "POS Cashier Terminal",
        "subdomain": "cashier",
        "defaultDomain": "cashier.camtech.cam",
        "purpose": "Rapid in-store retail checkout, barcode scan, split payment, and cash drawer.",
        "audience": ["CASHIER", "RETAIL_STAFF"],
        "allowedRoles": ["CASHIER", "BRANCH_MANAGER", "ORG_ADMIN", "SUPER_ADMIN"],
        "defaultRoute": "/sales/new",
        "modules": ["pos", "cart", "payments", "shift"],
        "features": ["barcode_scanner", "numpad", "split_payment", "offline_queue"]
    },
    "delivery": {
        "id": "delivery",
        "name": "Driver & Fleet Dispatch",
        "subdomain": "delivery",
        "defaultDomain": "delivery.camtech.cam",
        "purpose": "Mobile-first courier deliveries, route map, proof of delivery, and COD.",
        "audience": ["COURIER", "DELIVERY_DRIVER", "DISPATCHER"],
        "allowedRoles": ["COURIER", "DELIVERY_DRIVER", "DISPATCHER", "ORG_ADMIN", "SUPER_ADMIN"],
        "defaultRoute": "/driver",
        "modules": ["deliveries", "route", "pod", "cod"],
        "features": ["gps_telemetry", "proof_of_delivery", "call_customer", "cod_settlement"]
    },
    "warehouse": {
        "id": "warehouse",
        "name": "Warehouse WMS",
        "subdomain": "warehouse",
        "defaultDomain": "warehouse.camtech.cam",
        "purpose": "Warehouse execution: receiving, transfers, putaway, pick/pack/ship, and stock count.",
        "audience": ["WAREHOUSE_STAFF", "STOCK_CLERK"],
        "allowedRoles": ["WAREHOUSE_STAFF", "STOCK_CLERK", "BRANCH_MANAGER", "ORG_ADMIN", "SUPER_ADMIN"],
        "defaultRoute": "/transfers",
        "modules": ["transfers", "inventory", "zones", "batches"],
        "features": ["barcode_scan", "bin_locations", "lot_quarantine"]
    },
    "hr": {
        "id": "hr",
        "name": "HR People Operations",
        "subdomain": "hr",
        "defaultDomain": "hr.camtech.cam",
        "purpose": "Employee directory, attendance, leave approval workflows, and monthly payroll.",
        "audience": ["HR_MANAGER", "PEOPLE_OPS"],
        "allowedRoles": ["HR_MANAGER", "HR_STAFF", "ORG_ADMIN", "SUPER_ADMIN"],
        "defaultRoute": "/hr",
        "modules": ["employees", "departments", "leave", "payroll"],
        "features": ["leave_approvals", "salary_runs", "staff_roster"]
    },
    "finance": {
        "id": "finance",
        "name": "Finance & Accounts",
        "subdomain": "finance",
        "defaultDomain": "finance.camtech.cam",
        "purpose": "General ledger, chart of accounts, tax liabilities, fixed assets, and reconciliation.",
        "audience": ["ACCOUNTANT", "FINANCE_DIRECTOR", "CFO"],
        "allowedRoles": ["ACCOUNTANT", "FINANCE_DIRECTOR", "ORG_ADMIN", "SUPER_ADMIN"],
        "defaultRoute": "/finance",
        "modules": ["ledger", "coa", "taxes", "assets", "reports"],
        "features": ["financial_statements", "tax_calculation", "journal_entries"]
    },
    "partner": {
        "id": "partner",
        "name": "Partner & Developer Platform",
        "subdomain": "partner",
        "defaultDomain": "partner.camtech.cam",
        "purpose": "Developer API applications, scoped API keys, webhook feeds, and docs.",
        "audience": ["DEVELOPER", "PARTNER"],
        "allowedRoles": ["DEVELOPER", "PARTNER", "ORG_ADMIN", "SUPER_ADMIN"],
        "defaultRoute": "/developers",
        "modules": ["apps", "keys", "webhooks", "docs"],
        "features": ["hmac_signing", "key_scopes", "webhook_logs"]
    },
    "customer": {
        "id": "customer",
        "name": "Customer Portal",
        "subdomain": "customer",
        "defaultDomain": "customer.camtech.cam",
        "purpose": "Customer self-service: past orders, download invoices, track shipments, loyalty balance.",
        "audience": ["CUSTOMER"],
        "allowedRoles": ["*"],
        "defaultRoute": "/customer",
        "modules": ["orders", "invoices", "tracking", "loyalty"],
        "features": ["invoice_download", "loyalty_points", "track_shipment"]
    },
    "ceo": {
        "id": "ceo",
        "name": "Executive Command Center",
        "subdomain": "ceo",
        "defaultDomain": "ceo.camtech.cam",
        "purpose": "Global executive decision support: revenue, cash, AR/AP, branch performance, AI insights.",
        "audience": ["CEO", "EXECUTIVE", "BOARD"],
        "allowedRoles": ["CEO", "SUPER_ADMIN", "ORG_ADMIN"],
        "defaultRoute": "/dashboard",
        "modules": ["kpis", "drilldown", "ai_insights", "approvals"],
        "features": ["branch_comparison", "revenue_velocity", "ai_copilot"]
    },
    "admin": {
        "id": "admin",
        "name": "Enterprise Control Center",
        "subdomain": "admin",
        "defaultDomain": "admin.camtech.cam",
        "purpose": "Complete platform administration, tenant isolation, security, audit, and global settings.",
        "audience": ["SUPER_ADMIN", "ORG_ADMIN"],
        "allowedRoles": ["SUPER_ADMIN", "ORG_ADMIN"],
        "defaultRoute": "/settings",
        "modules": ["organizations", "users", "security", "audit", "settings"],
        "features": ["tenant_settings", "mfa_enforcement", "schema_audit", "backups"]
    }
}

# Tenant custom domain mappings: domain -> { orgId, appId }
_CUSTOM_DOMAINS: Dict[str, Dict[str, str]] = {}

class CustomDomainInput(BaseModel):
    domain: str
    targetAppId: str

@router.get("/registry")
async def get_application_registry():
    """
    Returns the complete enterprise application registry (Spec §242).
    """
    return {
        "applications": list(APP_REGISTRY_DATA.values()),
        "total": len(APP_REGISTRY_DATA)
    }

@router.get("/resolve")
async def resolve_domain(host: str = Query(..., description="Hostname or subdomain to resolve")):
    """
    Resolves an incoming domain/subdomain to its corresponding experience profile (Spec §240).
    """
    normalized = host.lower().split(":")[0].strip()

    # Check custom domain mapping (§241)
    if normalized in _CUSTOM_DOMAINS:
        mapping = _CUSTOM_DOMAINS[normalized]
        target_app = APP_REGISTRY_DATA.get(mapping["targetAppId"], APP_REGISTRY_DATA["admin"])
        return {
            "appId": target_app["id"],
            "application": target_app,
            "domain": normalized,
            "subdomain": target_app["subdomain"],
            "isCustomDomain": True,
            "organizationId": mapping.get("organizationId"),
            "resolvedRoute": target_app["defaultRoute"]
        }

    # Match subdomain prefix (e.g. store.camtech.cam -> store)
    parts = normalized.split(".")
    subdomain = parts[0] if len(parts) > 1 else "admin"

    if subdomain in APP_REGISTRY_DATA:
        target_app = APP_REGISTRY_DATA[subdomain]
    elif normalized in ["camtech.cam", "localhost", "127.0.0.1"]:
        target_app = APP_REGISTRY_DATA["ceo"]
    else:
        target_app = APP_REGISTRY_DATA["admin"]

    return {
        "appId": target_app["id"],
        "application": target_app,
        "domain": normalized,
        "subdomain": target_app["subdomain"],
        "isCustomDomain": False,
        "resolvedRoute": target_app["defaultRoute"]
    }

@router.post("/custom-domain")
async def register_custom_domain(
    inp: CustomDomainInput,
    user: TenantUser = Depends(get_current_user)
):
    """
    Registers a custom subdomain or domain for the tenant (Spec §241).
    """
    if inp.targetAppId not in APP_REGISTRY_DATA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid target application: {inp.targetAppId}"
        )

    norm = inp.domain.lower().split(":")[0].strip()
    _CUSTOM_DOMAINS[norm] = {
        "organizationId": user.organization_id,
        "targetAppId": inp.targetAppId
    }

    return {
        "domain": norm,
        "organizationId": user.organization_id,
        "targetAppId": inp.targetAppId,
        "status": "ACTIVE"
    }
