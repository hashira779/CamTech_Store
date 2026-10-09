from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, Optional
import urllib.parse
import hmac
import hashlib
import json
import time

from app.core.database import get_db
from app.core.security import create_access_token
from app.core.crypto import EncryptionService
from ..models import TelegramBot

router = APIRouter(tags=["Telegram Mini App"])

def validate_telegram_init_data(init_data: str, bot_token: str) -> bool:
    try:
        parsed = dict(urllib.parse.parse_qsl(init_data))
        if "hash" not in parsed:
            return False
        
        received_hash = parsed.pop("hash")
        
        # Sort keys alphabetically
        sorted_keys = sorted(parsed.keys())
        data_check_string = "\n".join(f"{k}={parsed[k]}" for k in sorted_keys)
        
        # Create secret key
        secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        
        # Calculate hash
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        return hmac.compare_digest(calculated_hash, received_hash)
    except Exception:
        return False

@router.post("/telegram/mini-app/auth")
async def telegram_mini_app_auth(
    data: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    init_data = data.get("initData")
    if not init_data:
        raise HTTPException(status_code=400, detail="Missing initData")
        
    # Get all active bots
    result = await db.execute(select(TelegramBot).where(TelegramBot.is_active == True))
    bots = result.scalars().all()
    
    matched_bot = None
    
    for bot in bots:
        try:
            token = EncryptionService.decrypt(bot.bot_token)
        except Exception:
            token = bot.bot_token
            
        if validate_telegram_init_data(init_data, token):
            matched_bot = bot
            break
            
    if not matched_bot:
        # Fallback for development/testing if no valid signature found
        # In production, this should throw 401
        raise HTTPException(status_code=401, detail="Invalid Telegram initData signature")

    parsed_data = dict(urllib.parse.parse_qsl(init_data))
    
    # Security: Prevent replay attacks by checking auth_date
    auth_date = parsed_data.get('auth_date')
    if not auth_date:
        raise HTTPException(status_code=401, detail="Missing auth_date in initData")
    
    try:
        auth_time = int(auth_date)
        current_time = int(time.time())
        # Reject if older than 24 hours (86400 seconds)
        if current_time - auth_time > 86400:
            raise HTTPException(status_code=401, detail="Telegram initData has expired")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid auth_date format")
    
    user_str = parsed_data.get('user')
    user_id = 'unknown'
    if user_str:
        try:
            user_json = json.loads(user_str)
            user_id = str(user_json.get("id", "unknown"))
        except Exception:
            pass
    
    # Create a scoped JWT token for this user and this organization
    access_token = create_access_token({
        "sub": f"tg_{user_id}", 
        "orgId": matched_bot.organization_id, 
        "roles": ["CUSTOMER"]
    })
    
    return {
        "success": True,
        "token": access_token,
        "organizationId": matched_bot.organization_id,
        "botName": matched_bot.name
    }
