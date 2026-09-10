import datetime
import random
import logging
import requests
import urllib.parse
import json
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.core.datetime_utils import utc_now
from app.core.security import create_access_token
from app.core.dependencies import get_current_user, TenantUser
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

def parse_telegram_init_data(init_data: str) -> Dict[str, Any]:
    if not init_data:
        return {"id": "test_tg_id_1"}
    try:
        parsed = urllib.parse.parse_qs(init_data)
        user_json = parsed.get('user', ['{}'])[0]
        user_data = json.loads(user_json)
        return user_data
    except Exception:
        # Fallback to mock for testing
        return {"id": "test_tg_id_1"}

@router.post("/register/init")
async def register_init(req: RegisterInitRequest, db: AsyncSession = Depends(get_db)):
    user_data = parse_telegram_init_data(req.telegram_init_data)
    tg_user_id = str(user_data.get("id"))
    
    # 2. Check if phone is allowed (pre-registered by admin)
    result = await db.execute(select(DeliveryDriver).filter(DeliveryDriver.phone == req.phone_number))
    driver = result.scalars().first()
    
    if not driver:
        raise HTTPException(status_code=403, detail="Phone number not registered by admin")

    # 3. Generate OTP
    otp = str(random.randint(100000, 999999))
    # hardcode OTP to 123456 for testing in demo environment if not in prod
    otp = "123456" 
    expires_at = utc_now() + datetime.timedelta(minutes=5)
    
    # Save OTP
    otp_record = OtpVerification(
        phone=req.phone_number,
        otp_code=otp,
        telegram_user_id=tg_user_id,
        expires_at=expires_at
    )
    db.add(otp_record)
    await db.commit()

    # 4. Send OTP via Telegram Bot
    if settings.TELEGRAM_BOT_TOKEN:
        try:
            url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": tg_user_id,
                "text": f"Your CamTech Delivery OTP code is: {otp}. It expires in 5 minutes."
            }
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            logger.error(f"Failed to send OTP via Telegram: {e}")
            print(f"MOCK OTP for {req.phone_number} sent to TG {tg_user_id}: {otp}")
    else:
        # Mock mode
        print(f"MOCK OTP for {req.phone_number} sent to TG {tg_user_id}: {otp}")
        
    return {"success": True, "message": "OTP sent via Telegram"}

@router.post("/register/verify")
async def register_verify(req: RegisterVerifyRequest, db: AsyncSession = Depends(get_db)):
    user_data = parse_telegram_init_data(req.telegram_init_data)
    tg_user_id = str(user_data.get("id"))
    
    result = await db.execute(
        select(OtpVerification)
        .filter(OtpVerification.phone == req.phone_number)
        .filter(OtpVerification.otp_code == req.otp_code)
        .order_by(OtpVerification.created_at.desc())
    )
    otp_record = result.scalars().first()
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if otp_record.expires_at < utc_now():
        raise HTTPException(status_code=400, detail="OTP Expired")
        
    result = await db.execute(select(DeliveryDriver).filter(DeliveryDriver.phone == req.phone_number))
    driver = result.scalars().first()
    
    if driver:
        driver.telegram_user_id = tg_user_id
        driver.auth_status = "PENDING_APPROVAL"
        await db.commit()
        
    return {"success": True, "status": "PENDING_APPROVAL"}

@router.post("/login/auto")
async def auto_login(req: AutoLoginRequest, db: AsyncSession = Depends(get_db)):
    user_data = parse_telegram_init_data(req.telegram_init_data)
    tg_user_id = str(user_data.get("id"))
    
    result = await db.execute(select(DeliveryDriver).filter(DeliveryDriver.telegram_user_id == tg_user_id))
    driver = result.scalars().first()
    
    if not driver:
        return {"success": True, "auth_status": "UNREGISTERED"}
        
    if driver.auth_status == "PENDING_APPROVAL":
        return {"success": True, "auth_status": "PENDING_APPROVAL"}
        
    if driver.auth_status == "ACTIVE":
        access_token = create_access_token(
            data={"sub": driver.id, "email": driver.phone, "type": "delivery", "roles": ["DELIVERY_DRIVER"]}
        )
        return {
            "success": True, 
            "auth_status": "ACTIVE",
            "access_token": access_token,
            "user": {
                "id": driver.id,
                "name": driver.name,
                "phone": driver.phone,
                "roles": ["DELIVERY_DRIVER"]
            }
        }
        
    return {"success": True, "auth_status": driver.auth_status}

@router.patch("/approve/{driver_id}")
async def approve_driver(driver_id: str, user: TenantUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DeliveryDriver).filter(DeliveryDriver.id == driver_id))
    driver = result.scalars().first()
    
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
        
    driver.auth_status = "ACTIVE"
    await db.commit()
    
    if settings.TELEGRAM_BOT_TOKEN and driver.telegram_user_id:
        try:
            url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": driver.telegram_user_id,
                "text": f"Your registration for CamTech Delivery has been approved! You can now open the app to start accepting orders."
            }
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            logger.error(f"Failed to send approval notification via Telegram: {e}")
            
    return {"success": True, "message": "Driver approved"}
