"""
Bot Builder — API Router.
Composes all sub-controllers into a single router:
  - Workflows (CRUD + publish + rollback + versions)
  - Commands (CRUD + sync to Telegram)
  - Runtime (webhook handler + webhook registration)
  - Executions (history + analytics)
"""
from fastapi import APIRouter
from .controllers.workflows_controller import router as workflows_router
from .controllers.commands_controller import router as commands_router
from .controllers.runtime_controller import router as runtime_router
from .controllers.executions_controller import router as executions_router

router = APIRouter(tags=["Bot Builder"])

router.include_router(workflows_router)
router.include_router(commands_router)
router.include_router(runtime_router)
router.include_router(executions_router)
