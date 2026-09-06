"""
Business Node Handlers — integrates the Bot Builder execution engine
directly with the MyStore database: Catalog, Orders, Bakong KHQR,
Delivery Fleet, and CRM Customer records.
All queries strictly enforce tenant isolation (organization_id).
"""
import logging
from typing import Any, Dict, List, Optional
from datetime import datetime, time as dt_time
import zoneinfo
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload

from app.modules.catalog.models import Product, Category, ProductVariant
from app.modules.sales.models import Sale, SaleStatusEnum
from app.modules.customers.models import Customer
from app.modules.delivery.models import DeliveryOrder, DeliveryDriver
from ..variable_resolver import resolve_template

logger = logging.getLogger("bot_builder.business_handlers")


class BusinessNodeHandlers:
    """Executes business domain nodes against the MyStore database."""

    @staticmethod
    async def search_products(
        db: Optional[AsyncSession],
        org_id: Optional[str],
        params: Dict[str, Any],
        context: Dict[str, Any],
        adapter: Any,
        chat_id: str,
    ) -> Dict[str, Any]:
        """Search products in catalog by keyword or category."""
        if not db or not org_id:
            msg = "Store catalog is currently offline."
            await adapter.send_message(chat_id, msg)
            return {"error": "db_not_available"}

        keyword = resolve_template(str(params.get("query", context.get("input", {}).get("message", ""))), context).strip()
        limit = int(params.get("limit", 5))

        stmt = (
            select(Product)
            .options(selectinload(Product.variants))
            .where(Product.organization_id == org_id, Product.is_active == True)
        )
        if keyword:
            stmt = stmt.where(Product.name.ilike(f"%{keyword}%"))
        stmt = stmt.order_by(desc(Product.created_at)).limit(limit)

        result = await db.execute(stmt)
        products = result.scalars().all()

        if not products:
            text = f"🔍 No products found matching '{keyword}'." if keyword else "🔍 No products currently available."
            await adapter.send_message(chat_id, text)
            return {"count": 0, "products": []}

        lines = ["🛍️ <b>Available Products:</b>\n"]
        buttons = []
        for p in products:
            variant = p.variants[0] if p.variants else None
            price_str = f"${float(variant.sell_price):.2f}" if variant and variant.sell_price else "Contact us"
            lines.append(f"• <b>{p.name}</b> — <code>{price_str}</code>")
            buttons.append([{"text": f"🏷️ {p.name} ({price_str})", "callback_data": f"prod_{p.id}"}])

        text = "\n".join(lines)
        reply_markup = {"inline_keyboard": buttons} if buttons else None
        await adapter.send_message(chat_id, text, parse_mode="HTML", reply_markup=reply_markup)

        return {"count": len(products), "products": [{"id": p.id, "name": p.name} for p in products]}

    @staticmethod
    async def get_order_status(
        db: Optional[AsyncSession],
        org_id: Optional[str],
        params: Dict[str, Any],
        context: Dict[str, Any],
        adapter: Any,
        chat_id: str,
    ) -> Dict[str, Any]:
        """Track and return customer order status."""
        if not db or not org_id:
            await adapter.send_message(chat_id, "Order tracking service unavailable.")
            return {"error": "db_not_available"}

        order_query = resolve_template(
            str(params.get("orderNumber", context.get("input", {}).get("message", ""))),
            context
        ).strip().upper()

        stmt = select(Sale).where(Sale.organization_id == org_id)
        if order_query:
            stmt = stmt.where(Sale.sale_number.ilike(f"%{order_query}%"))
        stmt = stmt.order_by(desc(Sale.created_at)).limit(1)

        res = await db.execute(stmt)
        sale = res.scalar_one_or_none()

        if not sale:
            text = f"❌ Order <code>{order_query}</code> not found. Please check your order code." if order_query else "Please enter your order code to track."
            await adapter.send_message(chat_id, text, parse_mode="HTML")
            return {"found": False}

        status_emoji = {
            "COMPLETED": "✅ Completed",
            "DRAFT": "⏳ Pending Payment",
            "REFUNDED": "🔄 Refunded",
            "VOIDED": "❌ Cancelled",
        }.get(str(sale.status), str(sale.status))

        text = (
            f"📋 <b>Order #{sale.sale_number}</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"• <b>Status:</b> {status_emoji}\n"
            f"• <b>Total:</b> ${float(sale.grand_total):.2f} {sale.currency}\n"
            f"• <b>Date:</b> {sale.created_at.strftime('%Y-%m-%d %H:%M') if sale.created_at else 'N/A'}\n"
            f"\nThank you for shopping with us!"
        )
        await adapter.send_message(chat_id, text, parse_mode="HTML")
        return {"found": True, "sale_number": sale.sale_number, "status": str(sale.status)}

    @staticmethod
    async def track_delivery(
        db: Optional[AsyncSession],
        org_id: Optional[str],
        params: Dict[str, Any],
        context: Dict[str, Any],
        adapter: Any,
        chat_id: str,
    ) -> Dict[str, Any]:
        """Track active courier delivery by tracking number or customer phone."""
        if not db or not org_id:
            await adapter.send_message(chat_id, "Delivery tracking unavailable.")
            return {"error": "db_not_available"}

        track_no = resolve_template(
            str(params.get("trackingNumber", context.get("input", {}).get("message", ""))),
            context
        ).strip().upper()

        stmt = (
            select(DeliveryOrder)
            .options(selectinload(DeliveryOrder.driver))
            .where(DeliveryOrder.organization_id == org_id)
        )
        if track_no:
            stmt = stmt.where(DeliveryOrder.tracking_number.ilike(f"%{track_no}%"))
        stmt = stmt.order_by(desc(DeliveryOrder.created_at)).limit(1)

        res = await db.execute(stmt)
        order = res.scalar_one_or_none()

        if not order:
            await adapter.send_message(
                chat_id,
                f"🛵 No active delivery found for <code>{track_no}</code>.",
                parse_mode="HTML"
            )
            return {"found": False}

        driver_name = order.driver.name if order.driver else "Assigning courier..."
        driver_phone = order.driver.phone if order.driver else "N/A"
        eta = f"{order.eta_minutes} mins" if order.eta_minutes else "En route"

        status_badge = {
            "DELIVERED": "🏁 Delivered",
            "IN_TRANSIT": "🚚 Out for Delivery",
            "PICKED_UP": "📦 Courier Picked Up",
            "PENDING": "⏳ Preparing Dispatch",
        }.get(order.status, order.status)

        text = (
            f"🛵 <b>Delivery Tracking: {order.tracking_number}</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"• <b>Status:</b> {status_badge}\n"
            f"• <b>Courier:</b> {driver_name} ({driver_phone})\n"
            f"• <b>Est. Arrival:</b> {eta}\n"
            f"• <b>Address:</b> {order.delivery_address}\n"
        )
        await adapter.send_message(chat_id, text, parse_mode="HTML")
        return {"found": True, "tracking": order.tracking_number, "status": order.status}

    @staticmethod
    async def generate_khqr(
        db: Optional[AsyncSession],
        org_id: Optional[str],
        params: Dict[str, Any],
        context: Dict[str, Any],
        adapter: Any,
        chat_id: str,
    ) -> Dict[str, Any]:
        """Generate Bakong KHQR payment instructions with dynamic QR."""
        amount_raw = resolve_template(str(params.get("amount", "10.00")), context)
        try:
            amount = float(amount_raw)
        except ValueError:
            amount = 10.00

        currency = params.get("currency", "USD").upper()
        order_ref = resolve_template(str(params.get("orderId", f"ORD-{int(datetime.utcnow().timestamp())}")), context)

        # Quick QR photo generation link via standard Bakong QR SVG/PNG endpoint or QR service
        qr_url = f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=bakong_khqr_{order_ref}_{amount}_{currency}"

        caption = (
            f"🇰🇭 <b>Bakong KHQR Payment</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"• <b>Amount:</b> ${amount:.2f} {currency}\n"
            f"• <b>Ref:</b> <code>{order_ref}</code>\n\n"
            f"📲 Scan with <b>Bakong</b> or any Cambodian mobile banking app (ABA, Wing, ACLEDA, Sathapana) to complete payment."
        )

        try:
            await adapter.send_photo(chat_id, qr_url, caption)
        except Exception:
            await adapter.send_message(chat_id, caption, parse_mode="HTML")

        return {"qr_url": qr_url, "amount": amount, "currency": currency, "ref": order_ref}

    @staticmethod
    async def lookup_customer(
        db: Optional[AsyncSession],
        org_id: Optional[str],
        params: Dict[str, Any],
        context: Dict[str, Any],
        adapter: Any,
        chat_id: str,
    ) -> Dict[str, Any]:
        """Lookup customer profile by phone or name."""
        if not db or not org_id:
            return {"error": "db_not_available"}

        phone = resolve_template(str(params.get("phone", context.get("input", {}).get("message", ""))), context).strip()
        if not phone:
            await adapter.send_message(chat_id, "Please provide your phone number to check membership.")
            return {"found": False}

        stmt = (
            select(Customer)
            .where(Customer.organization_id == org_id, Customer.phone.ilike(f"%{phone}%"))
            .limit(1)
        )
        res = await db.execute(stmt)
        customer = res.scalar_one_or_none()

        if not customer:
            text = f"👤 Customer record for <code>{phone}</code> not found."
            await adapter.send_message(chat_id, text, parse_mode="HTML")
            return {"found": False}

        text = (
            f"👤 <b>Customer Profile: {customer.name}</b>\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"• <b>Tier:</b> ⭐ {customer.loyalty_tier}\n"
            f"• <b>Reward Points:</b> 🎯 {customer.loyalty_points} pts\n"
            f"• <b>Store Credit:</b> ${float(customer.store_credit):.2f}\n"
        )
        await adapter.send_message(chat_id, text, parse_mode="HTML")
        return {
            "found": True,
            "name": customer.name,
            "tier": customer.loyalty_tier,
            "points": customer.loyalty_points,
        }

    @staticmethod
    async def alert_admin(
        params: Dict[str, Any],
        context: Dict[str, Any],
        adapter: Any,
    ) -> Dict[str, Any]:
        """Alert store manager or staff on Telegram."""
        admin_chat_id = params.get("adminChatId") or params.get("chatId")
        if not admin_chat_id:
            logger.warning("alert_admin called without adminChatId")
            return {"success": False, "reason": "no_admin_chat_id"}

        msg = resolve_template(str(params.get("message", "🚨 Attention: New bot escalation or order!")), context)
        await adapter.send_message(str(admin_chat_id), f"🚨 <b>Store Admin Alert</b>\n\n{msg}", parse_mode="HTML")
        return {"success": True}

    @staticmethod
    def check_business_hours(params: Dict[str, Any]) -> bool:
        """Branch logic based on whether store is currently open."""
        open_time_str = params.get("openTime", "08:00")
        close_time_str = params.get("closeTime", "21:00")
        tz_name = params.get("timezone", "Asia/Phnom_Penh")

        try:
            tz = zoneinfo.ZoneInfo(tz_name)
            now_local = datetime.now(tz).time()

            o_h, o_m = map(int, open_time_str.split(":"))
            c_h, c_m = map(int, close_time_str.split(":"))

            open_time = dt_time(o_h, o_m)
            close_time = dt_time(c_h, c_m)

            if open_time <= close_time:
                return open_time <= now_local <= close_time
            else:  # Overnight span
                return now_local >= open_time or now_local <= close_time
        except Exception as e:
            logger.error("Error evaluating business hours: %s", e)
            return True
