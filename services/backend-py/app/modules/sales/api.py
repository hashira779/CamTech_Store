"""
Sales Domain Router.
Composes modular sub-routers:
- POS Sales & Transactions (pos_controller)
- Store & Public Checkouts (checkout_controller)
- Customer Order History (orders_controller)
"""
from fastapi import APIRouter
from .controllers.pos_controller import router as pos_router
from .controllers.checkout_controller import router as checkout_router
from .controllers.orders_controller import router as orders_router
from .controllers.helpers import derive_payment_status

# Backward compatibility alias
_derive_payment_status = derive_payment_status

router = APIRouter(tags=["Sales"])

# Mount modular sub-controllers
router.include_router(pos_router)
router.include_router(checkout_router)
router.include_router(orders_router)
