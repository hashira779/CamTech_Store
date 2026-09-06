import uvicorn
from app.microservices.common import create_microservice
from app.modules.bot_builder.api import router as bot_builder_router

app = create_microservice(
    name="Bot Builder & Telegram AI Microservice",
    description=(
        "Standalone microservice for visual no-code Telegram bot orchestration, "
        "webhook routing, catalog resolution, dynamic Bakong KHQR checkout, and order tracking."
    ),
    port=4008,
)

app.include_router(bot_builder_router, prefix="/api/v1")

if __name__ == "__main__":
    print("🚀 Starting Bot Builder & Telegram AI Microservice on http://localhost:4008...")
    uvicorn.run(app, host="0.0.0.0", port=4008)
