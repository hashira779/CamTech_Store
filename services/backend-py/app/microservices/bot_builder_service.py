from contextlib import asynccontextmanager
import uvicorn
from fastapi import FastAPI
from app.microservices.common import create_microservice
from app.modules.bot_builder.api import router as bot_builder_router


async def _sync_active_bot_webhooks():
    """Auto-heal and synchronize Telegram webhooks on service boot."""
    try:
        import logging
        from sqlalchemy import select
        from app.core.database import AsyncSessionLocal
        from app.modules.automations.models import TelegramBot
        from app.core.crypto import EncryptionService
        from app.modules.bot_builder.engine.telegram_adapter import TelegramAdapter
        from app.core.config import settings

        logger = logging.getLogger("bot_builder.startup")
        gateway_base = getattr(settings, "GATEWAY_URL", "").rstrip("/")
        if not gateway_base or not gateway_base.startswith("https://"):
            gateway_base = "https://gateway.camtech.cam"

        async with AsyncSessionLocal() as db:
            result = await db.execute(select(TelegramBot).where(TelegramBot.is_active == True))
            bots = result.scalars().all()
            for bot in bots:
                if not bot.bot_token:
                    continue
                try:
                    decrypted_token = EncryptionService.decrypt(bot.bot_token)
                except Exception:
                    decrypted_token = bot.bot_token

                adapter = TelegramAdapter(decrypted_token)
                expected_url = f"{gateway_base}/api/v1/bot-builder/webhook/{bot.id}"
                info = await adapter.get_webhook_info()
                current_url = info.get("result", {}).get("url", "")
                if current_url != expected_url:
                    logger.info("Auto-registering webhook for bot %s (%s) -> %s", bot.name, bot.id, expected_url)
                    await adapter.set_webhook(expected_url)
                else:
                    logger.info("Bot %s webhook already active and verified: %s", bot.name, expected_url)
    except Exception as exc:
        import logging
        logging.getLogger("bot_builder.startup").warning("Startup webhook sync skipped: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _sync_active_bot_webhooks()
    yield


app = create_microservice(
    name="Bot Builder & Telegram AI Microservice",
    description=(
        "Standalone microservice for visual no-code Telegram bot orchestration, "
        "webhook routing, catalog resolution, dynamic Bakong KHQR checkout, and order tracking."
    ),
    port=4008,
    lifespan=lifespan,
)

app.include_router(bot_builder_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting Bot Builder & Telegram AI Microservice on http://localhost:4008...")
    uvicorn.run(app, host="0.0.0.0", port=4008)
