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

    @staticmethod
    def _tlv(tag: str, value: str) -> str:
        if len(value) > 99:
            raise ValueError(f"KHQR tag {tag} value exceeds 99 characters")
        return f"{tag}{len(value):02d}{value}"

    @staticmethod
    def _ascii(value: str, limit: int) -> str:
        # EMVCo lengths count characters; keep the primary fields ASCII so lengths stay exact.
        clean = "".join(ch for ch in (value or "") if 32 <= ord(ch) < 127).strip()
        return clean[:limit]

    @staticmethod
    def format_amount(amount: float, currency: str) -> str:
        """Tag 54: KHR has no minor unit; USD carries at most 2 decimals."""
        if currency.upper() == "KHR":
            return str(int(Decimal(str(amount)).quantize(Decimal("1"), rounding=ROUND_HALF_UP)))
        return f"{Decimal(str(amount)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP):.2f}"

    @classmethod
    def generate_dynamic_qr(
        cls,
        merchant_name: str,
        account_id: str,
        amount: float,
        currency: str = "USD",
        merchant_city: str = "Phnom Penh",
        bill_number: Optional[str] = None,
        acquiring_bank: Optional[str] = None,
        created_at_ms: Optional[int] = None,
        expires_in_seconds: int = 900,
        account_type: str = "INDIVIDUAL",
        merchant_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Builds a dynamic Bakong KHQR (EMVCo merchant-presented QR) locally — no network call.

        Layout: 00 format · 01 dynamic(12)
        · 29 individual [00 Bakong account ID, 02 acquiring bank?]  or  30 merchant [00 account ID, 01 merchant ID, 02 acquiring bank]
        · 52 MCC · 53 currency (840 USD / 116 KHR) · 54 amount · 58 KH · 59 name · 60 city
        · 62 additional data [01 bill number] · 99 [00 created ms, 01 expires ms] · 63 CRC16-CCITT (0x1021, init 0xFFFF).
        The bill number and timestamps make every order's string — and therefore its MD5 — unique.
        """
        import hashlib
        import time

        if not account_id or "@" not in account_id:
            raise ValueError("A Bakong account ID (name@bank) is required")
        is_merchant = (account_type or "INDIVIDUAL").upper() == "MERCHANT"
        if is_merchant and (not merchant_id or not acquiring_bank):
            raise ValueError("A merchant KHQR needs the merchant ID and acquiring bank from the Bakong app")
        cur = currency.upper()
        if cur not in ("USD", "KHR"):
            raise ValueError("KHQR supports USD and KHR only")
        if amount is None or Decimal(str(amount)) <= 0:
            raise ValueError("Dynamic KHQR requires a positive amount")

        created_ms = created_at_ms or int(time.time() * 1000)
        expires_ms = created_ms + expires_in_seconds * 1000

        account_info = cls._tlv("00", account_id.strip())
        if is_merchant:
            account_info += cls._tlv("01", cls._ascii(merchant_id, 32))
        if acquiring_bank:
            account_info += cls._tlv("02", cls._ascii(acquiring_bank, 32))

        additional = cls._tlv("01", cls._ascii(bill_number, 25)) if bill_number else ""
        timestamps = cls._tlv("00", str(created_ms)) + cls._tlv("01", str(expires_ms))

        payload = (
            cls._tlv("00", "01")
            + cls._tlv("01", "12")
            + cls._tlv("30" if is_merchant else "29", account_info)
            + cls._tlv("52", "5999")
            + cls._tlv("53", "840" if cur == "USD" else "116")
            + cls._tlv("54", cls.format_amount(amount, cur))
            + cls._tlv("58", "KH")
            + cls._tlv("59", cls._ascii(merchant_name, 25) or "Merchant")
            + cls._tlv("60", cls._ascii(merchant_city, 15) or "Phnom Penh")
            + (cls._tlv("62", additional) if additional else "")
            + cls._tlv("99", timestamps)
        )
        crc_input = payload + "6304"
        qr_string = crc_input + cls._crc16_ccitt(crc_input)

        return {
            "qrString": qr_string,
            "md5": hashlib.md5(qr_string.encode("utf-8")).hexdigest(),
            "amount": amount,
            "currency": cur,
            "merchantName": merchant_name,
            "billNumber": bill_number,
            "createdAtMs": created_ms,
            "expiresAtMs": expires_ms,
        }

    @staticmethod
    def parse(qr_string: str) -> Dict[str, Any]:
        """Decodes a KHQR string into {tag: value | nested dict} and validates its CRC. Used for self-checks and tests."""
        def walk(s: str, nested: set) -> Dict[str, Any]:
            out, i = {}, 0
            while i < len(s):
                tag, ln = s[i:i + 2], int(s[i + 2:i + 4])
                val = s[i + 4:i + 4 + ln]
                if len(val) != ln:
                    raise ValueError(f"Truncated tag {tag}")
                out[tag] = walk(val, set()) if tag in nested else val
                i += 4 + ln
            return out

        if not qr_string.endswith(KhqrGenerator._crc16_ccitt(qr_string[:-4])):
            raise ValueError("KHQR CRC mismatch")
        return walk(qr_string, {"29", "30", "62", "99"})

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
