"""
Automations & Integrations Domain Router.
Composes modular sub-routers:
- Developer Apps & API Keys (developer_apps_controller)
- Webhooks (webhooks_controller)
- Telegram Bots & Chat Bindings (telegram_controller)
- Automation Flows & Executions (flows_controller)
"""
from fastapi import APIRouter
from .controllers.developer_apps_controller import router as dev_router
from .controllers.webhooks_controller import router as webhooks_router
from .controllers.telegram_controller import router as telegram_router
from .controllers.flows_controller import router as flows_router

router = APIRouter(tags=["Automations & Integrations"])

# Mount modular sub-controllers
router.include_router(dev_router)
router.include_router(webhooks_router)
router.include_router(telegram_router)
router.include_router(flows_router)
