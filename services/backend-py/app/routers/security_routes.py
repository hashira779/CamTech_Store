"""
Security Admin API — IP Ban Management & Threat Dashboard.
All endpoints require ORG_ADMIN or SUPER_ADMIN role.
Prefix: /api/v1/security
"""
import time
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from app.core.dependencies import TenantUser, RequirePermissions
from app.core.rate_limiter import ip_ban_list, AUTO_BAN_DURATION_SECONDS, PERM_BAN_DURATION_SECONDS

router = APIRouter(prefix="/security", tags=["Security — IP Management"])

# "security:manage" is admin-only by construction (absent from every role row in
# PERMISSIONS_MATRIX), so this keeps the previous ORG_ADMIN/SUPER_ADMIN-only
# behaviour while routing the check through the shared RBAC matrix.
_require_admin = RequirePermissions(["security:manage"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class BanIPRequest(BaseModel):
    ip: str = Field(..., description="IPv4 or IPv6 address to ban", example="1.2.3.4")
    duration_hours: Optional[float] = Field(
        None,
        description="Ban duration in hours. Omit for permanent (1-year) ban.",
        example=24,
    )
    reason: Optional[str] = Field("manual ban by admin", description="Reason for the ban")


class UnbanIPRequest(BaseModel):
    ip: str = Field(..., description="IPv4 or IPv6 address to unban")


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/bans", summary="List all active IP bans")
async def list_bans(admin: TenantUser = Depends(_require_admin)):
    """Return all currently banned IPs with their metadata and remaining TTL."""
    bans = await ip_ban_list.list_bans()
    return {
        "total": len(bans),
        "bans": sorted(bans, key=lambda b: b.get("banned_at", 0), reverse=True),
    }


@router.post("/bans", status_code=status.HTTP_201_CREATED, summary="Ban an IP address")
async def ban_ip(body: BanIPRequest, admin: TenantUser = Depends(_require_admin)):
    """
    Manually ban an IP address.
    - Leave `duration_hours` empty for a permanent (1-year) ban.
    - Bans are stored in Redis and survive service restarts.
    """
    # Basic IP validation (no library dependency)
    ip = body.ip.strip()
    if not ip or len(ip) > 45:
        raise HTTPException(status_code=400, detail="Invalid IP address.")

    duration_seconds = (
        int(body.duration_hours * 3600)
        if body.duration_hours is not None
        else PERM_BAN_DURATION_SECONDS
    )

    already = await ip_ban_list.get_ban_info(ip)
    if already:
        return {
            "message": f"IP {ip} is already banned.",
            "existing_ban": already,
        }

    metadata = await ip_ban_list.ban(
        ip,
        duration_seconds=duration_seconds,
        reason=body.reason or "manual ban by admin",
        admin_id=admin.id,
    )
    return {"message": f"IP {ip} has been banned.", "ban": metadata}


@router.delete("/bans/{ip}", summary="Unban an IP address")
async def unban_ip(ip: str, admin: TenantUser = Depends(_require_admin)):
    """Remove a ban on the specified IP address."""
    existed = await ip_ban_list.unban(ip.strip(), admin_id=admin.id)
    if not existed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IP {ip} is not currently banned.",
        )
    return {"message": f"IP {ip} has been unbanned successfully."}


@router.get("/bans/{ip}", summary="Check if a specific IP is banned")
async def check_ban(ip: str, admin: TenantUser = Depends(_require_admin)):
    """Return ban metadata for a specific IP, or 404 if not banned."""
    info = await ip_ban_list.get_ban_info(ip.strip())
    if not info:
        return {"ip": ip, "banned": False}
    return {"ip": ip, "banned": True, **info}


@router.get("/status", summary="Security system status & configuration")
async def security_status(admin: TenantUser = Depends(_require_admin)):
    """Return current security configuration and active protection status."""
    bans = await ip_ban_list.list_bans()
    return {
        "protection_layers": [
            {
                "layer": "Nginx Edge",
                "active": True,
                "features": [
                    "Slowloris mitigation (10s client timeouts)",
                    "Connection limit: 20 per IP",
                    "Rate limit: 30 req/s API, 5 req/s auth (burst 30/5)",
                    "Fast-fail 429 (no queueing)",
                    "Scanner bot blocking (empty UA, masscan, zgrab, nmap, nikto, sqlmap)",
                ],
            },
            {
                "layer": "Python Middleware",
                "active": True,
                "features": [
                    "IP ban list check on every /api/v1/ request",
                    "Global rate limit: 100 req/min per IP",
                    "Auth rate limit: 15 req/min per IP",
                    f"Auto-ban: triggered after {os.getenv('BAN_THRESHOLD', '5')} rate-limit violations",
                    f"Auto-ban duration: {int(os.getenv('AUTO_BAN_DURATION', '3600')) // 60} minutes",
                    "Security headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options",
                ],
            },
            {
                "layer": "Cloudflare Tunnel",
                "active": True,
                "features": [
                    "Zero Trust Tunnel — no exposed ports",
                    "Cloudflare DDoS L3/L4 protection",
                    "Under Attack Mode available (manual activation)",
                ],
            },
        ],
        "active_bans": len(bans),
        "auto_ban_threshold": int(os.getenv("BAN_THRESHOLD", "5")),
        "auto_ban_duration_minutes": int(os.getenv("AUTO_BAN_DURATION", "3600")) // 60,
        "timestamp": time.time(),
    }
