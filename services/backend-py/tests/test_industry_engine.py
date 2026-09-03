import pytest
from datetime import datetime, timezone, timedelta
from app.domain.industry_engine import IndustryEngine, INDUSTRY_PRESETS

def test_industry_presets_coverage():
    assert "RETAIL" in INDUSTRY_PRESETS
    assert "RESTAURANT" in INDUSTRY_PRESETS
    assert "FUEL_STATION" in INDUSTRY_PRESETS
    assert "PHARMACY" in INDUSTRY_PRESETS
    assert "ELECTRONICS" in INDUSTRY_PRESETS
    assert "WHOLESALE" in INDUSTRY_PRESETS

def test_recipe_bom_deductions():
    recipe_bom = [
        {"ingredientVariantId": "ing_espresso_beans", "quantityPerServing": 0.018, "unit": "kg"},
        {"ingredientVariantId": "ing_fresh_milk", "quantityPerServing": 0.200, "unit": "liter"},
    ]
    # Ordering 5 cups of latte
    deductions = IndustryEngine.calculate_recipe_deductions(recipe_bom, 5.0)
    assert len(deductions) == 2
    assert deductions[0]["deductQuantity"] == 0.090  # 18g * 5 = 90g
    assert deductions[1]["deductQuantity"] == 1.000  # 200ml * 5 = 1L

def test_table_and_kds_transitions():
    assert IndustryEngine.validate_table_transition("VACANT", "OCCUPIED") is True
    assert IndustryEngine.validate_table_transition("OCCUPIED", "BILL_PRINTED") is True
    assert IndustryEngine.validate_table_transition("VACANT", "BILL_PRINTED") is False

    assert IndustryEngine.validate_kds_transition("ORDERED", "PREPARING") is True
    assert IndustryEngine.validate_kds_transition("PREPARING", "READY") is True
    assert IndustryEngine.validate_kds_transition("READY", "SERVED") is True
    assert IndustryEngine.validate_kds_transition("ORDERED", "SERVED") is False

def test_fuel_reconciliation():
    # 5,000 liters pumped, opening meter 10,000, closing 15,000
    # Price $1.15/L -> $5,750
    # Start tank 20,000, received 0, end tank 14,990 (10L variance)
    res = IndustryEngine.reconcile_fuel_shift(
        opening_meter=10000.0,
        closing_meter=15000.0,
        fuel_price_per_liter=1.15,
        tank_dip_start_liters=20000.0,
        tank_dip_end_liters=14990.0,
        deliveries_received_liters=0.0
    )
    assert res["dispensedLiters"] == 5000.0
    assert res["totalSalesAmount"] == 5750.0
    assert res["varianceLiters"] == -10.0
    assert res["isWithinTolerance"] is True
    assert res["reconciliationStatus"] == "BALANCED"

def test_pharmacy_drug_expiry():
    now = datetime.now(timezone.utc)

    # 15 days left (Expiring Critical)
    soon = (now + timedelta(days=15)).isoformat()
    eval_soon = IndustryEngine.evaluate_drug_expiry_risk(soon)
    assert eval_soon["status"] == "EXPIRING_CRITICAL"
    assert eval_soon["canDispense"] is True

    # Already expired
    past = (now - timedelta(days=5)).isoformat()
    eval_past = IndustryEngine.evaluate_drug_expiry_risk(past)
    assert eval_past["status"] == "EXPIRED"
    assert eval_past["canDispense"] is False

def test_electronics_warranty_validation():
    now = datetime.now(timezone.utc)

    # Sold 3 months ago with 12 months warranty -> active
    sold_recent = (now - timedelta(days=90)).isoformat()
    res_active = IndustryEngine.validate_serial_warranty(sold_recent, 12)
    assert res_active["isUnderWarranty"] is True
    assert res_active["status"] == "ACTIVE_WARRANTY"

    # Sold 24 months ago with 12 months warranty -> expired
    sold_old = (now - timedelta(days=730)).isoformat()
    res_expired = IndustryEngine.validate_serial_warranty(sold_old, 12)
    assert res_expired["isUnderWarranty"] is False
    assert res_expired["status"] == "WARRANTY_EXPIRED"
