import datetime
import secrets
import time
import logging
import httpx
import urllib.parse
import json
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.core.security import create_access_token
from app.core.access_policy import ADMIN, MANAGER
from app.core.dependencies import get_current_user, TenantUser
from app.core.rate_limiter import auth_rate_limiter
from .models import DeliveryDriver, OtpVerification

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Delivery Auth"])

class RegisterInitRequest(BaseModel):
    phone_number: str
    telegram_init_data: str

class RegisterVerifyRequest(BaseModel):
    phone_number: str
    otp_code: str
    telegram_init_data: str

class AutoLoginRequest(BaseModel):
    telegram_init_data: str

TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 86400


async def _telegram_bot_tokens(db: AsyncSession) -> list[str]:
    from app.core.crypto import EncryptionService
    from app.modules.automations.models import TelegramBot

    tokens = [getattr(settings, "TELEGRAM_BOT_TOKEN", None), getattr(settings, "TELEGRAM_ALERT_BOT_TOKEN", None)]
    bots = (await db.execute(select(TelegramBot).where(TelegramBot.is_active == True))).scalars().all()
    for bot in bots:
        try:
            tokens.append(EncryptionService.decrypt(bot.bot_token))
        except Exception:
            tokens.append(bot.bot_token)
    return [token for token in tokens if token]


async def verified_telegram_user(init_data: str, db: AsyncSession) -> Dict[str, Any]:
    """The Telegram user from init data signed by one of our bots. Unsigned data proves nothing."""
    from app.modules.automations.controllers.telegram_mini_app_controller import validate_telegram_init_data

    denied = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telegram sign-in could not be verified")
    if not init_data:
        raise denied
    tokens = await _telegram_bot_tokens(db)
    if not any(validate_telegram_init_data(init_data, token) for token in tokens):
        raise denied

    parsed = dict(urllib.parse.parse_qsl(init_data))
    try:
        is_fresh = time.time() - int(parsed.get("auth_date", "0")) <= TELEGRAM_INIT_DATA_MAX_AGE_SECONDS
        user = json.loads(parsed.get("user") or "{}")
    except ValueError:
        raise denied
    if not is_fresh or not user.get("id"):
        raise denied
    return user

import re

def normalize_phone(phone: str) -> str:
    cleaned = re.sub(r"[^\d+]", "", phone or "").strip()
    if cleaned.startswith("+855"):
        cleaned = "0" + cleaned[4:]
    elif cleaned.startswith("855"):
        cleaned = "0" + cleaned[3:]
    return cleaned

def get_phone_variants(phone: str) -> list[str]:
    raw = (phone or "").strip()
    norm = normalize_phone(raw)
    variants = {raw, norm}
    if norm.startswith("0"):
        digits = norm[1:]
        variants.add("+855" + digits)
        variants.add("855" + digits)
        variants.add(digits)
    return list(variants)

async def find_driver_by_phone(db: AsyncSession, phone: str):
    variants = get_phone_variants(phone)
    result = await db.execute(select(DeliveryDriver).filter(DeliveryDriver.phone.in_(variants)))
    driver = result.scalars().first()
    if not driver:
        # Fallback: scan normalized phones in database
        norm_target = normalize_phone(phone)
        all_drivers = (await db.execute(select(DeliveryDriver))).scalars().all()
        for d in all_drivers:
            if normalize_phone(d.phone) == norm_target:
                return d
    return driver

async def get_telegram_bot_token(db: AsyncSession, org_id: str | None = None) -> str | None:
    """Resolve Telegram bot token with 3-tier fallback:
    1. settings.TELEGRAM_BOT_TOKEN
    2. Active DELIVERY/Primary bot in telegram_bots table
    3. settings.TELEGRAM_ALERT_BOT_TOKEN
    """
    if getattr(settings, "TELEGRAM_BOT_TOKEN", None):
        return settings.TELEGRAM_BOT_TOKEN
        
    try:
        from app.modules.automations.models import TelegramBot
        from app.core.crypto import EncryptionService
        query = select(TelegramBot).where(TelegramBot.is_active == True)
        if org_id:
            query = query.where(TelegramBot.organization_id == org_id)
        query = query.order_by(
            (TelegramBot.purpose == "DELIVERY").desc(),
            TelegramBot.is_primary.desc(),
            TelegramBot.created_at.desc()
        )
        result = await db.execute(query)
        bot = result.scalars().first()
        if bot and bot.bot_token:
            try:
                return EncryptionService.decrypt(bot.bot_token)
            except Exception:
                return bot.bot_token
    except Exception as e:
        logger.warning("Failed to lookup telegram bot token from DB: %s", e)

    if getattr(settings, "TELEGRAM_ALERT_BOT_TOKEN", None):
        return settings.TELEGRAM_ALERT_BOT_TOKEN

    return None

@router.post("/register/init")
async def register_init(req: RegisterInitRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await auth_rate_limiter.check(request)
    user_data = await verified_telegram_user(req.telegram_init_data, db)

    # 2. Check if phone is allowed (pre-registered by admin)
    driver = await find_driver_by_phone(db, req.phone_number)

    if not driver:
        raise HTTPException(
            status_code=403,
            detail="Phone number not registered by admin. Please contact your company dispatcher to add you to the fleet."
        )

    # A driver already bound to Telegram gets the code there, whoever is asking.
    tg_user_id = driver.telegram_user_id or str(user_data["id"])

    # 3. Generate secure 6-digit OTP
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = utc_now() + datetime.timedelta(minutes=5)
    
    # Save OTP record
    otp_record = OtpVerification(
        phone=req.phone_number,
        otp_code=otp,
        telegram_user_id=tg_user_id or "UNKNOWN",
        expires_at=expires_at
    )
    db.add(otp_record)
    await db.commit()

    # 4. Send OTP via Telegram Bot
    bot_token = await get_telegram_bot_token(db, driver.organization_id)
    telegram_sent = False

    if bot_token and tg_user_id:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": tg_user_id,
                "text": f"🔐 *CamTech Delivery Verification Code*\n\nYour OTP is: `{otp}`\n\nThis code expires in 5 minutes. Never share this code with anyone.",
                "parse_mode": "Markdown"
            }
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, timeout=5.0)
                if res.status_code == 200:
                    telegram_sent = True
                    logger.info("OTP successfully sent via Telegram to chat %s", tg_user_id)
                else:
                    logger.warning("Telegram sendMessage returned %s: %s", res.status_code, res.text)
        except Exception as e:
            logger.error("Failed to send OTP via Telegram: %s", e)

    if not telegram_sent:
        logger.warning("Telegram OTP dispatch unavailable for driver %s", driver.id)
        
    return {
        "success": True, 
        "message": "OTP sent via Telegram" if telegram_sent else "OTP code generated. Please check Telegram or use fallback code."
    }

@router.post("/register/verify")
async def register_verify(req: RegisterVerifyRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await auth_rate_limiter.check(request)
    user_data = await verified_telegram_user(req.telegram_init_data, db)
    tg_user_id = str(user_data["id"])

    result = await db.execute(
        select(OtpVerification)
        .filter(OtpVerification.phone == req.phone_number)
        .filter(OtpVerification.otp_code == req.otp_code)
        .filter(OtpVerification.telegram_user_id == tg_user_id)
        .order_by(OtpVerification.created_at.desc())
    )
    otp_record = result.scalars().first()
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    exp = otp_record.expires_at
    if exp:
        if exp.tzinfo is not None:
            exp = exp.astimezone(datetime.timezone.utc).replace(tzinfo=None)
        if exp < utc_now():
            raise HTTPException(status_code=400, detail="OTP Expired")
        
    # Single use: a code that worked once must not work again.
    await db.delete(otp_record)
    driver = await find_driver_by_phone(db, req.phone_number)

    if driver:
        driver.telegram_user_id = tg_user_id
        driver.auth_status = "ACTIVE"
        driver.is_active = True
        await db.commit()
        await db.refresh(driver)
        access_token = create_access_token(
            data={
                "sub": driver.id,
                "orgId": driver.organization_id,
                "organization_id": driver.organization_id,
                "email": driver.phone,
                "type": "delivery",
                "roles": ["DELIVERY_DRIVER"],
            }
        )
        return {
            "success": True,
            "status": "ACTIVE",
            "access_token": access_token,
            "user": {
                "id": driver.id,
                "name": driver.name,
                "phone": driver.phone,
                "roles": ["DELIVERY_DRIVER"],
                "organizationId": driver.organization_id,
            }
        }
        
    return {"success": True, "status": "PENDING_APPROVAL"}

@router.post("/login/auto")
async def auto_login(req: AutoLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await auth_rate_limiter.check(request)
    user_data = await verified_telegram_user(req.telegram_init_data, db)
    tg_user_id = str(user_data["id"])
    
    result = await db.execute(select(DeliveryDriver).filter(DeliveryDriver.telegram_user_id == tg_user_id))
    driver = result.scalars().first()
    
    if not driver:
        return {"success": True, "auth_status": "UNREGISTERED"}
        
    if driver.auth_status == "PENDING_APPROVAL":
        return {"success": True, "auth_status": "PENDING_APPROVAL"}
        
    if driver.auth_status == "ACTIVE":
        access_token = create_access_token(
            data={
                "sub": driver.id,
                "orgId": driver.organization_id,
                "organization_id": driver.organization_id,
                "email": driver.phone,
                "type": "delivery",
                "roles": ["DELIVERY_DRIVER"],
            }
        )
        return {
            "success": True, 
            "auth_status": "ACTIVE",
            "access_token": access_token,
            "user": {
                "id": driver.id,
                "name": driver.name,
                "phone": driver.phone,
                "roles": ["DELIVERY_DRIVER"],
                "organizationId": driver.organization_id,
            }
        }
        
    return {"success": True, "auth_status": driver.auth_status}

@router.patch("/approve/{driver_id}")
async def approve_driver(driver_id: str, user: TenantUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not set(user.roles) & (ADMIN | MANAGER):
        raise HTTPException(status_code=403, detail="Only an admin or manager can approve drivers")
    result = await db.execute(
        select(DeliveryDriver).filter(DeliveryDriver.id == driver_id, DeliveryDriver.organization_id == user.organization_id)
    )
    driver = result.scalars().first()

    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    driver.auth_status = "ACTIVE"
    driver.is_active = True
    await db.commit()
    
    bot_token = await get_telegram_bot_token(db, driver.organization_id)
    if bot_token and driver.telegram_user_id:
        try:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": driver.telegram_user_id,
                "text": "🎉 *CamTech Delivery Approval*\n\nYour registration has been approved! You can now open the app to start accepting delivery orders.",
                "parse_mode": "Markdown"
            }
            async with httpx.AsyncClient() as client:
                await client.post(url, json=payload, timeout=5.0)
        except Exception as e:
            logger.error("Failed to send approval notification via Telegram: %s", e)
            
    return {"success": True, "message": "Driver approved"}
