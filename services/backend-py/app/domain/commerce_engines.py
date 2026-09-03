import math
from typing import List, Dict, Any, Optional
from decimal import Decimal, ROUND_HALF_UP

# ==============================================================================
# 1. BAKONG KHQR EMVCo CRC-16 GENERATOR
# ==============================================================================

class KhqrGenerator:
    @staticmethod
    def _crc16_ccitt(data: str) -> str:
        crc = 0xFFFF
        for char in data.encode('utf-8'):
            crc ^= (char << 8)
            for _ in range(8):
                if (crc & 0x8000) != 0:
                    crc = ((crc << 1) ^ 0x1021) & 0xFFFF
                else:
                    crc = (crc << 1) & 0xFFFF
        return f"{crc:04X}"

    @classmethod
    def generate_dynamic_qr(cls, merchant_name: str, account_id: str, amount: float, currency: str = "USD") -> Dict[str, Any]:
        curr_code = "840" if currency.upper() == "USD" else "116"
        amt_str = f"{amount:.2f}"
        
        def format_tag(tag: str, val: str) -> str:
            return f"{tag}{len(val):02d}{val}"

        # EMVCo tags
        payload = (
            format_tag("00", "01") +
            format_tag("01", "12") +
            format_tag("29", format_tag("00", "bakong@dev") + format_tag("01", account_id)) +
            format_tag("52", "0000") +
            format_tag("53", curr_code) +
            format_tag("54", amt_str) +
            format_tag("58", "KH") +
            format_tag("59", merchant_name[:25]) +
            format_tag("60", "Phnom Penh")
        )
        
        crc_input = payload + "6304"
        checksum = cls._crc16_ccitt(crc_input)
        raw_qr = crc_input + checksum
        
        return {
            "qrString": raw_qr,
            "md5": checksum,
            "amount": amount,
            "currency": currency,
            "merchantName": merchant_name,
        }

# ==============================================================================
# 2. MULTI-TIER TAX CALCULATOR
# ==============================================================================

class TaxCalculator:
    @staticmethod
    def calculate_tax(
        amount: Decimal, 
        rate_pct: Decimal, 
        is_inclusive: bool = False
    ) -> Dict[str, Decimal]:
        rate_factor = rate_pct / Decimal('100.0')
        if is_inclusive:
            base_amount = (amount / (Decimal('1.0') + rate_factor)).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            tax_amount = (amount - base_amount).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            total_amount = amount
        else:
            base_amount = amount
            tax_amount = (amount * rate_factor).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
            total_amount = (base_amount + tax_amount).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)

        return {
            "baseAmount": base_amount,
            "taxAmount": tax_amount,
            "totalAmount": total_amount,
            "ratePct": rate_pct,
        }

# ==============================================================================
# 3. PROMOTIONS & DISCOUNTS EVALUATOR
# ==============================================================================

class PromotionEvaluator:
    @staticmethod
    def evaluate(
        promo_type: str,
        promo_value: Decimal,
        cart_total: Decimal,
        items: List[Dict[str, Any]],
        min_spend: Decimal = Decimal('0.0')
    ) -> Dict[str, Any]:
        if cart_total < min_spend:
            return {
                "applicable": False,
                "discount": Decimal('0.0'),
                "reason": f"Cart subtotal (${cart_total}) is below minimum spend (${min_spend})"
            }

        discount = Decimal('0.0')

        if promo_type == "PERCENTAGE":
            discount = (cart_total * (promo_value / Decimal('100.0'))).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        elif promo_type == "FIXED_AMOUNT":
            discount = min(promo_value, cart_total)
        elif promo_type == "BUY_X_GET_Y":
            # e.g., Buy 2 get 1 free
            x = int(promo_value) or 2
            for item in items:
                qty = int(item.get("quantity", 0))
                free_items = qty // (x + 1)
                item_price = Decimal(str(item.get("unitPrice", 0)))
                discount += Decimal(free_items) * item_price

        return {
            "applicable": True,
            "discount": discount,
            "finalTotal": max(Decimal('0.0'), cart_total - discount)
        }

# ==============================================================================
# 4. TIERED PRICING RESOLVER
# ==============================================================================

class PricingResolver:
    @staticmethod
    def resolve_price(
        base_price: Decimal,
        customer_tier: str,
        quantity: int,
        tier_discounts: Optional[Dict[str, Decimal]] = None
    ) -> Decimal:
        discounts = tier_discounts or {
            "VIP": Decimal('15.0'),
            "WHOLESALE": Decimal('20.0'),
            "REGULAR": Decimal('0.0')
        }
        discount_pct = discounts.get(customer_tier.upper(), Decimal('0.0'))
        
        # Volume break discount: 5% extra if qty >= 10
        if quantity >= 10:
            discount_pct += Decimal('5.0')

        factor = max(Decimal('0.0'), (Decimal('100.0') - discount_pct) / Decimal('100.0'))
        return (base_price * factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

# ==============================================================================
# 5. LOYALTY POINTS CALCULATOR
# ==============================================================================

class LoyaltyCalculator:
    @staticmethod
    def calculate_accrual(spend_amount: Decimal, tier: str = "BRONZE") -> int:
        multipliers = {
            "BRONZE": Decimal('1.0'),
            "SILVER": Decimal('1.25'),
            "GOLD": Decimal('1.5'),
            "PLATINUM": Decimal('2.0')
        }
        mult = multipliers.get(tier.upper(), Decimal('1.0'))
        return int(spend_amount * mult)

    @staticmethod
    def calculate_redemption_value(points: int, point_value: Decimal = Decimal('0.01')) -> Decimal:
        return (Decimal(points) * point_value).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
