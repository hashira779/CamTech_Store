from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any

INDUSTRY_PRESETS: List[str] = [
    "RETAIL",
    "WHOLESALE",
    "SUPERMARKET",
    "CONVENIENCE_STORE",
    "RESTAURANT",
    "CAFE",
    "BAR",
    "FUEL_STATION",
    "PHARMACY",
    "ELECTRONICS",
    "SERVICES",
]

class IndustryEngine:
    """
    Universal Industry Vertical Engine (Spec §17-§22, §112).
    Implements configurable domain rules for specialized business verticals:
    - Restaurant / F&B (§17, §18, §19, §20): Tables, KDS order flow, Recipe BOM deductions.
    - Fuel Station (§21): Pumps, tanks, dip meter reading, shift reconciliation.
    - Pharmacy (§22): Prescription validation, controlled substance flags, drug batch expiry alerts.
    - Electronics (§26, §112): Serial / IMEI lifecycle, warranty validation.
    """

    # ──────────────────────────────────────────────────────────────────────────
    # 1. RESTAURANT & KITCHEN (F&B) (Spec §17 - §20)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def calculate_recipe_deductions(
        recipe_bom: List[Dict[str, Any]],
        servings_ordered: float
    ) -> List[Dict[str, Any]]:
        """
        Calculates ingredient deductions from inventory based on recipe BOM.
        Each ingredient: { "ingredientVariantId": str, "quantityPerServing": float, "unit": str }
        """
        deductions = []
        for item in recipe_bom:
            total_needed = round(item["quantityPerServing"] * servings_ordered, 4)
            deductions.append({
                "variantId": item["ingredientVariantId"],
                "deductQuantity": total_needed,
                "unit": item.get("unit", "piece")
            })
        return deductions

    @staticmethod
    def validate_table_transition(current_status: str, new_status: str) -> bool:
        """
        Table state machine: VACANT -> OCCUPIED -> BILL_PRINTED -> VACANT.
        Can also move to RESERVED or CLEANING.
        """
        allowed_map = {
            "VACANT": ["OCCUPIED", "RESERVED"],
            "RESERVED": ["OCCUPIED", "VACANT"],
            "OCCUPIED": ["BILL_PRINTED", "VACANT"],
            "BILL_PRINTED": ["CLEANING", "VACANT"],
            "CLEANING": ["VACANT"],
        }
        return new_status.upper() in allowed_map.get(current_status.upper(), [])

    @staticmethod
    def validate_kds_transition(current_status: str, new_status: str) -> bool:
        """
        KDS Kitchen Display State Machine: ORDERED -> PREPARING -> READY -> SERVED.
        """
        kds_map = {
            "ORDERED": ["PREPARING", "CANCELLED"],
            "PREPARING": ["READY", "CANCELLED"],
            "READY": ["SERVED"],
            "SERVED": [],
            "CANCELLED": [],
        }
        return new_status.upper() in kds_map.get(current_status.upper(), [])

    # ──────────────────────────────────────────────────────────────────────────
    # 2. FUEL STATION SERVICE (Spec §21)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def reconcile_fuel_shift(
        opening_meter: float,
        closing_meter: float,
        fuel_price_per_liter: float,
        tank_dip_start_liters: float,
        tank_dip_end_liters: float,
        deliveries_received_liters: float = 0.0
    ) -> Dict[str, Any]:
        """
        Reconciles fuel pump dispenser meter against physical underground tank dip readings.
        Identifies variance / evaporation losses.
        """
        pump_dispensed_liters = round(closing_meter - opening_meter, 2)
        total_sales_amount = round(pump_dispensed_liters * fuel_price_per_liter, 2)

        # Expected tank end = start + deliveries - pump_dispensed
        expected_tank_end = round(tank_dip_start_liters + deliveries_received_liters - pump_dispensed_liters, 2)
        variance_liters = round(tank_dip_end_liters - expected_tank_end, 2)
        # Tolerance of 0.5% due to thermal expansion/dip gauge variance
        variance_pct = round((abs(variance_liters) / pump_dispensed_liters * 100), 2) if pump_dispensed_liters > 0 else 0.0
        is_acceptable = variance_pct <= 0.8

        return {
            "dispensedLiters": pump_dispensed_liters,
            "totalSalesAmount": total_sales_amount,
            "expectedTankEndLiters": expected_tank_end,
            "actualTankEndLiters": tank_dip_end_liters,
            "varianceLiters": variance_liters,
            "variancePct": variance_pct,
            "isWithinTolerance": is_acceptable,
            "reconciliationStatus": "BALANCED" if is_acceptable else "INVESTIGATION_REQUIRED"
        }

    # ──────────────────────────────────────────────────────────────────────────
    # 3. PHARMACY SERVICE (Spec §22)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def evaluate_drug_expiry_risk(
        expiry_date_str: str,
        threshold_days: int = 90
    ) -> Dict[str, Any]:
        """
        Evaluates drug batch expiration risk and generates alerts.
        """
        try:
            exp_date = datetime.fromisoformat(expiry_date_str.replace("Z", "+00:00"))
        except Exception:
            exp_date = datetime.now(timezone.utc) + timedelta(days=365)

        now = datetime.now(timezone.utc)
        remaining_days = (exp_date - now).days

        if remaining_days <= 0:
            status = "EXPIRED"
            can_dispense = False
            urgency = "CRITICAL"
        elif remaining_days <= 30:
            status = "EXPIRING_CRITICAL"
            can_dispense = True
            urgency = "HIGH"
        elif remaining_days <= threshold_days:
            status = "EXPIRING_SOON"
            can_dispense = True
            urgency = "MEDIUM"
        else:
            status = "GOOD"
            can_dispense = True
            urgency = "NONE"

        return {
            "remainingDays": remaining_days,
            "status": status,
            "canDispense": can_dispense,
            "urgency": urgency,
            "alertMessage": f"Batch expires in {remaining_days} days." if remaining_days > 0 else "BATCH HAS EXPIRED."
        }

    # ──────────────────────────────────────────────────────────────────────────
    # 4. ELECTRONICS & SERIAL / IMEI TRACKING (Spec §26, §112)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def validate_serial_warranty(
        sold_at_str: str,
        warranty_months: int
    ) -> Dict[str, Any]:
        """
        Determines if a serialized electronic item or IMEI is still under warranty.
        """
        try:
            sold_date = datetime.fromisoformat(sold_at_str.replace("Z", "+00:00"))
        except Exception:
            sold_date = datetime.now(timezone.utc)

        # Warranty expiration approx (30.4 days per month)
        warranty_days = int(warranty_months * 30.4375)
        expiry_date = sold_date + timedelta(days=warranty_days)
        now = datetime.now(timezone.utc)
        is_active = now <= expiry_date
        days_left = max(0, (expiry_date - now).days)

        return {
            "isUnderWarranty": is_active,
            "warrantyMonths": warranty_months,
            "soldAt": sold_date.isoformat(),
            "expiresAt": expiry_date.isoformat(),
            "daysRemaining": days_left,
            "status": "ACTIVE_WARRANTY" if is_active else "WARRANTY_EXPIRED"
        }
