import json
import uuid
import secrets
from decimal import Decimal
from typing import Optional, List, Any, Tuple
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.datetime_utils import utc_now
from app.modules.organizations.models import Organization
from app.modules.customers.models import Customer
from app.modules.identity.models import User
from app.modules.catalog.models import ProductVariant, Product
from app.modules.inventory.models import InventoryItem, StockMovement
from app.models.entities import NotificationRecord
from app.modules.delivery import service as delivery_svc
from app.modules.delivery.schemas import CreateDeliveryOrderInput

from ..models import Sale, SaleLineItem, SalePayment

class CheckoutOrchestrator:
    @staticmethod
    async def resolve_target_org(db: AsyncSession, payload_org_id: Optional[str], user_org_id: Optional[str], items: List[Any]) -> str:
        target_org = user_org_id
        if not target_org and payload_org_id:
            # Storefront links carry either the organization id or its slug (?org= / ?store=).
            target_org = (await db.execute(
                select(Organization.id).where((Organization.id == payload_org_id) | (Organization.slug == payload_org_id)).limit(1)
            )).scalar_one_or_none()
        if not target_org and items:
            first_item_id = items[0].id
            if first_item_id:
                pv_res = await db.execute(
                    select(ProductVariant.organization_id).where(ProductVariant.id == first_item_id).limit(1)
                )
                target_org = pv_res.scalar_one_or_none()
                if not target_org:
                    prod_res = await db.execute(
                        select(Product.organization_id).where(Product.id == first_item_id).limit(1)
                    )
                    target_org = prod_res.scalar_one_or_none()

        if not target_org:
            # Never guess a tenant: an order without a resolvable store must not land in someone else's books.
            raise HTTPException(status_code=400, detail="Unable to determine the store for this order.")
        return target_org

    @staticmethod
    async def provision_customer(db: AsyncSession, target_org: str, payload: Any) -> Tuple[Customer, str, str, str]:
        phone_clean = payload.customerPhone.strip() if payload.customerPhone else None
        email_clean = payload.customerEmail.strip().lower() if payload.customerEmail else (f"{phone_clean}@customer.camtech.cam" if phone_clean else f"guest_{secrets.token_hex(4)}@customer.camtech.cam")
        name_clean = payload.customerName.strip() or email_clean.split("@")[0]

        cust_result = await db.execute(
            select(Customer).where(
                Customer.organization_id == target_org,
                func.lower(Customer.email) == email_clean
            ).limit(1)
        )
        customer = cust_result.scalar_one_or_none()
        if not customer and phone_clean:
            cust_phone_result = await db.execute(
                select(Customer).where(
                    Customer.organization_id == target_org,
                    Customer.phone == phone_clean
                ).limit(1)
            )
            customer = cust_phone_result.scalar_one_or_none()
        if not customer:
            customer = Customer(
                organization_id=target_org,
                code=f"CUST-{uuid.uuid4().hex[:8].upper()}",
                name=name_clean,
                email=email_clean,
                phone=phone_clean,
                type="INDIVIDUAL",
                loyalty_points=500,
                loyalty_tier="Executive Gold",
                store_credit=0.0,
                notes=json.dumps({"notes": "Store Customer via Online Checkout", "cart": []}),
                is_active=True
            )
            db.add(customer)
            await db.flush()
        return customer, email_clean, phone_clean, name_clean

    @staticmethod
    async def resolve_sale_user(db: AsyncSession, target_org: str, email_clean: str) -> str:
        # Both lookups stay inside the store's tenant: a sale must never be attributed to another org's user.
        user_result = await db.execute(
            select(User.id).where(
                User.organization_id == target_org,
                func.lower(User.email) == email_clean,
            ).limit(1)
        )
        sale_user_id = user_result.scalar_one_or_none()
        if not sale_user_id:
            org_user_res = await db.execute(
                select(User.id).where(User.organization_id == target_org).order_by(User.created_at.asc()).limit(1)
            )
            sale_user_id = org_user_res.scalar_one_or_none()
        if not sale_user_id:
            raise HTTPException(status_code=409, detail="This store has no staff account to own online orders yet.")
        return sale_user_id

    @staticmethod
    async def calculate_totals_and_lines(db: AsyncSession, target_org: str, sale_id: str, items: List[Any]) -> Tuple[Decimal, Decimal, List[SaleLineItem], List[dict]]:
        subtotal = Decimal("0.0")
        tax_total = Decimal("0.0")
        line_entities = []
        resolved_line_items = []

        for it in items:
            qty = Decimal(str(it.quantity))
            if qty <= 0:
                raise HTTPException(status_code=400, detail=f"Invalid quantity for '{it.name}'.")

            pv_obj = await CheckoutOrchestrator._resolve_variant(db, target_org, it.id, it.sku)
            if not pv_obj:
                raise HTTPException(status_code=400, detail=f"'{it.name}' is not available in this store.")
            resolved_variant_id = pv_obj.id
            resolved_variant_name = pv_obj.name or it.category or "Standard"
            resolved_sku = pv_obj.sku or it.sku

            # Zero-trust pricing: the catalog sell price is the floor. A client may send a higher unit
            # price (client-side size/add-on options are not modelled in the catalog yet) but never a lower one.
            catalog_price = Decimal(str(pv_obj.sell_price or 0))
            price = max(Decimal(str(it.price)), catalog_price).quantize(Decimal("0.01"))
            line_sub = (qty * price).quantize(Decimal("0.01"))
            tax_pct = Decimal("10.0")
            tax_amt = (line_sub * (tax_pct / Decimal("100.0"))).quantize(Decimal("0.01"))
            line_tot = line_sub + tax_amt

            subtotal += line_sub
            tax_total += tax_amt

            resolved_line_items.append({
                "variant_id": resolved_variant_id,
                "quantity": qty,
                "name": it.name,
            })

            line_entities.append(SaleLineItem(
                id=str(uuid.uuid4()),
                sale_id=sale_id,
                product_variant_id=resolved_variant_id,
                sku=resolved_sku or f"SKU-{str(resolved_variant_id)[:6] if resolved_variant_id else 'DEF'}",
                product_name=it.name,
                variant_name=resolved_variant_name,
                quantity=qty,
                unit_price=price,
                discount=Decimal("0.0"),
                tax_rate_pct=tax_pct,
                tax_amount=tax_amt,
                line_total=line_tot
            ))

        return subtotal, tax_total, line_entities, resolved_line_items

    @staticmethod
    async def _resolve_variant(db: AsyncSession, target_org: str, item_id: Optional[str], sku: Optional[str]) -> Optional[ProductVariant]:
        """Resolves a cart line to an active variant of the target store (by variant id, product id, then SKU)."""
        scoped = select(ProductVariant).where(
            ProductVariant.organization_id == target_org,
            ProductVariant.is_active == True,
        )
        if item_id:
            pv = (await db.execute(scoped.where(ProductVariant.id == item_id).limit(1))).scalar_one_or_none()
            if pv:
                return pv
            pv = (await db.execute(
                scoped.where(ProductVariant.product_id == item_id).order_by(ProductVariant.created_at.asc()).limit(1)
            )).scalar_one_or_none()
            if pv:
                return pv
        if sku:
            return (await db.execute(scoped.where(ProductVariant.sku == sku).limit(1))).scalar_one_or_none()
        return None

    @staticmethod
    async def process_inventory_and_alerts(
        db: AsyncSession, target_org: str, sale_id: str, sale_num: str, sale_user_id: str, resolved_line_items: List[dict]
    ):
        now = utc_now()
        for r_item in resolved_line_items:
            v_id = r_item["variant_id"]
            if not v_id:
                continue
            qty_num = r_item["quantity"]
            inv_stmt = select(InventoryItem).where(
                InventoryItem.organization_id == target_org,
                InventoryItem.product_variant_id == v_id
            ).limit(1)
            inv_res = await db.execute(inv_stmt)
            inv_rec = inv_res.scalar_one_or_none()

            if inv_rec:
                inv_rec.stock_on_hand = Decimal(str(inv_rec.stock_on_hand)) - qty_num
                inv_rec.updated_at = now
                bal = inv_rec.stock_on_hand

                mv = StockMovement(
                    id=str(uuid.uuid4()),
                    organization_id=target_org,
                    inventory_item_id=inv_rec.id,
                    type="SALE",
                    quantity=qty_num,
                    balance_after=bal,
                    reference_type="SALE",
                    reference_id=sale_id,
                    notes=f"Online Store Checkout {sale_num}",
                    user_id=sale_user_id,
                    created_at=now,
                )
                db.add(mv)

                if inv_rec.reorder_point is not None and inv_rec.stock_on_hand <= Decimal(str(inv_rec.reorder_point)):
                    low_stock_note = NotificationRecord(
                        id=str(uuid.uuid4()),
                        organization_id=target_org,
                        user_id=None,
                        channel="IN_APP",
                        type="LOW_STOCK_ALERT",
                        title="⚠️ Low Stock Alert",
                        message=f"Stock for '{r_item.get('name', 'Product')}' dropped to {bal} (reorder threshold: {inv_rec.reorder_point}).",
                        status="SENT",
                        is_read=False,
                        sent_at=now,
                        created_at=now,
                    )
                    db.add(low_stock_note)

    @staticmethod
    async def trigger_dispatch_and_notifications(
        db: AsyncSession, target_org: str, payload: Any, sale_id: str, sale_num: str,
        name_clean: str, phone_clean: str, line_entities: List[SaleLineItem], grand_total: Decimal, pay_method: str
    ):
        now = utc_now()
        dest_lat = payload.destLat if payload.destLat is not None else 11.5564
        dest_lng = payload.destLng if payload.destLng is not None else 104.9282
        deliv_addr = (payload.deliveryAddress or "Customer Address, Phnom Penh").strip()

        # Create Delivery Order
        deliv_input = CreateDeliveryOrderInput(
            recipientName=name_clean,
            recipientPhone=phone_clean or "N/A",
            deliveryAddress=deliv_addr,
            destLat=dest_lat,
            destLng=dest_lng,
            codAmount=float(grand_total) if pay_method == "CASH" else 0.0,
            deliveryFee=2.50,
            saleId=sale_id,
            notes=f"Storefront Order {sale_num} ({len(line_entities)} items)"
        )
        deliv_order = await delivery_svc.create_order(
            db, org_id=target_org, inp=deliv_input, initial_status="PREPARING"
        )

        deliv_alert = NotificationRecord(
            id=str(uuid.uuid4()),
            organization_id=target_org,
            user_id=None,
            channel="IN_APP",
            type="ORDER_CREATED",
            title=f"🚚 Delivery Order Preparing #{sale_num}",
            message=f"Customer {name_clean} ordered {len(line_entities)} items for delivery to {deliv_addr}. Courier dispatch will begin after packing. Tracking: {deliv_order.trackingNumber}.",
            status="SENT",
            is_read=False,
            sent_at=now,
            created_at=now,
            metadata_={
                "saleId": sale_id,
                "saleNumber": sale_num,
                "trackingNumber": deliv_order.trackingNumber,
                "deliveryOrderId": deliv_order.id,
                "recipientName": name_clean,
                "recipientPhone": phone_clean,
                "deliveryAddress": deliv_addr,
                "targetAudience": "DELIVERY",
            }
        )
        db.add(deliv_alert)

        items_summary = ", ".join([f"{li.quantity}x {li.product_name}" for li in line_entities[:3]])
        if len(line_entities) > 3:
            items_summary += f" +{len(line_entities) - 3} more"

        stocker_alert = NotificationRecord(
            id=str(uuid.uuid4()),
            organization_id=target_org,
            user_id=None,
            channel="IN_APP",
            type="ORDER_CREATED",
            title=f"📦 Customer Order Ready to Pick #{sale_num}",
            message=f"Order #{sale_num} requires warehouse stock picking: {items_summary}. Destination: {deliv_addr}.",
            status="SENT",
            is_read=False,
            sent_at=now,
            created_at=now,
            metadata_={
                "saleId": sale_id,
                "saleNumber": sale_num,
                "customerName": name_clean,
                "itemCount": len(line_entities),
                "targetAudience": "STOCKER",
                "wmsStatus": "PENDING_PICKING",
            }
        )
        db.add(stocker_alert)
        await db.commit()

        # Broadcast SSE Events
        try:
            from app.domain.event_bus import event_bus
            await event_bus.publish(
                target_org,
                "SALE_COMPLETED",
                {
                    "saleId": sale_id,
                    "saleNumber": sale_num,
                    "customerName": name_clean,
                    "totalAmount": float(grand_total),
                    "itemCount": len(line_entities),
                    "trackingNumber": deliv_order.trackingNumber,
                }
            )
            await event_bus.publish(
                target_org,
                "ORDER_CREATED",
                {
                    "saleId": sale_id,
                    "saleNumber": sale_num,
                    "customerName": name_clean,
                    "itemCount": len(line_entities),
                    "totalAmount": float(grand_total),
                    "deliveryAddress": deliv_addr,
                    "trackingNumber": deliv_order.trackingNumber,
                }
            )
        except Exception:
            pass

        # Telegram notification
        try:
            from app.modules.automations.models import TelegramBot
            from app.core.crypto import EncryptionService
            from app.modules.bot_builder.engine.telegram_adapter import TelegramAdapter
            bot_res = await db.execute(
                select(TelegramBot).where(
                    TelegramBot.organization_id == target_org,
                    TelegramBot.is_active == True
                ).order_by((TelegramBot.purpose == "DELIVERY").desc(), TelegramBot.is_primary.desc())
            )
            tg_bot = bot_res.scalars().first()
            if tg_bot and tg_bot.bot_token and tg_bot.default_chat_id:
                raw_token = EncryptionService.decrypt(tg_bot.bot_token)
                adapter = TelegramAdapter(raw_token)
                msg_text = (
                    f"🛍 <b>New Online Order #{sale_num}</b>\n\n"
                    f"👤 <b>Customer:</b> {name_clean}\n"
                    f"📞 <b>Phone:</b> {phone_clean}\n"
                    f"📦 <b>Items:</b> {len(line_entities)} items ({items_summary})\n"
                    f"💰 <b>Total:</b> ${float(grand_total):.2f}\n"
                    f"📍 <b>Delivery:</b> {deliv_addr}\n"
                    f"🛵 <b>Tracking:</b> <code>{deliv_order.trackingNumber}</code>"
                )
                await adapter.send_message(tg_bot.default_chat_id, msg_text)
        except Exception:
            pass

        return deliv_order, deliv_addr
