import pytest
from decimal import Decimal
from app.domain.commerce_engines import (
    KhqrGenerator,
    TaxCalculator,
    PromotionEvaluator,
    PricingResolver,
    LoyaltyCalculator,
)
from app.domain.enterprise_engines import (
    DepreciationCalculator,
    PayrollCalculator,
    ApiKeyGenerator,
    TelegramCommandRouter,
    FlowExecutionEngine,
)

def test_khqr_crc16_generation():
    qr = KhqrGenerator.generate_dynamic_qr("Central Cafe", "sokha@dev", 25.50, "USD")
    assert "qrString" in qr
    assert "840" in qr["qrString"]  # USD
    assert len(qr["md5"]) == 4

def test_tax_calculator():
    # Inclusive 10% on $110 -> Base $100, Tax $10
    inc = TaxCalculator.calculate_tax(Decimal('110.0'), Decimal('10.0'), is_inclusive=True)
    assert inc["baseAmount"] == Decimal('100.0')
    assert inc["taxAmount"] == Decimal('10.0')

    # Exclusive 10% on $100 -> Base $100, Tax $10, Total $110
    exc = TaxCalculator.calculate_tax(Decimal('100.0'), Decimal('10.0'), is_inclusive=False)
    assert exc["baseAmount"] == Decimal('100.0')
    assert exc["taxAmount"] == Decimal('10.0')
    assert exc["totalAmount"] == Decimal('110.0')

def test_promotion_evaluator():
    # 20% off on $100
    res = PromotionEvaluator.evaluate("PERCENTAGE", Decimal('20.0'), Decimal('100.0'), [])
    assert res["applicable"] is True
    assert res["discount"] == Decimal('20.0')
    assert res["finalTotal"] == Decimal('80.0')

    # Min spend requirement
    fail_res = PromotionEvaluator.evaluate("FIXED_AMOUNT", Decimal('10.0'), Decimal('40.0'), [], min_spend=Decimal('50.0'))
    assert fail_res["applicable"] is False

def test_pricing_resolver():
    # VIP gets 15% off $100 -> $85
    p = PricingResolver.resolve_price(Decimal('100.0'), "VIP", 1)
    assert p == Decimal('85.0')

    # Regular with bulk break (>= 10) gets 5% -> $95
    p_bulk = PricingResolver.resolve_price(Decimal('100.0'), "REGULAR", 10)
    assert p_bulk == Decimal('95.0')

def test_loyalty_calculator():
    # Gold tier gets 1.5x on $100 spend -> 150 points
    points = LoyaltyCalculator.calculate_accrual(Decimal('100.0'), "GOLD")
    assert points == 150

    # 150 points at $0.01 = $1.50
    val = LoyaltyCalculator.calculate_redemption_value(150)
    assert val == Decimal('1.50')

def test_depreciation_calculator():
    # Cost $1,200, Salvage $0, 12 months -> $100/mo
    dep = DepreciationCalculator.calculate_monthly(
        purchase_cost=Decimal('1200.0'),
        salvage_value=Decimal('0.0'),
        useful_life_months=12,
        accumulated_depreciation=Decimal('0.0'),
        method="STRAIGHT_LINE"
    )
    assert dep["monthlyDepreciation"] == Decimal('100.0')
    assert dep["newBookValue"] == Decimal('1100.0')

def test_payroll_calculator():
    # Base $1,000 + $200 allowance - $100 deduction = $1,100 taxable. 5% tax = $55. Net = $1,045
    pay = PayrollCalculator.calculate_net_pay(
        base_salary=Decimal('1000.0'),
        allowances=Decimal('200.0'),
        deductions=Decimal('100.0'),
        tax_rate_pct=Decimal('5.0')
    )
    assert pay["grossPay"] == Decimal('1200.0')
    assert pay["taxAmount"] == Decimal('55.0')
    assert pay["netPay"] == Decimal('1045.0')

def test_api_key_generator():
    key_info = ApiKeyGenerator.generate_api_key("live")
    assert key_info["rawKey"].startswith("sk_live_")
    assert ApiKeyGenerator.verify_key(key_info["rawKey"], key_info["keyHash"]) is True
    assert ApiKeyGenerator.verify_key("sk_live_fake", key_info["keyHash"]) is False

def test_telegram_router():
    msg = TelegramCommandRouter.route_command("/sales", context={"salesToday": "500.00", "orderCount": 10})
    assert "Sales Summary" in msg
    assert "$500.00" in msg

@pytest.mark.asyncio
async def test_flow_execution_engine():
    nodes = [
        {"id": "n1", "type": "TRIGGER", "subtype": "manual_trigger"},
        {
            "id": "n2", 
            "type": "CONDITION", 
            "subtype": "if_condition",
            "parameters": {"field": "{{trigger.amount}}", "operator": "GREATER_THAN", "value": 100}
        },
        {
            "id": "n3", 
            "type": "ACTION", 
            "subtype": "send_telegram",
            "parameters": {"text": "VIP Order: ${{trigger.amount}}"}
        }
    ]
    edges = [
        {"sourceNodeId": "n1", "targetNodeId": "n2"},
        {"sourceNodeId": "n2", "targetNodeId": "n3", "sourceHandle": "true"}
    ]

    res = await FlowExecutionEngine.execute(nodes, edges, {"amount": 250})
    assert res["status"] == "SUCCESS"
    assert len(res["executionTrace"]) == 3
    assert res["executionTrace"][2]["outputData"]["params"]["text"] == "VIP Order: $250"

@pytest.mark.asyncio
async def test_flow_loop_guard():
    # Cyclic graph n1 -> n2 -> n3 -> n2
    nodes = [
        {"id": "n1", "type": "TRIGGER", "subtype": "manual_trigger"},
        {"id": "n2", "type": "TRANSFORM", "subtype": "mapper"},
        {"id": "n3", "type": "TRANSFORM", "subtype": "mapper"}
    ]
    edges = [
        {"sourceNodeId": "n1", "targetNodeId": "n2"},
        {"sourceNodeId": "n2", "targetNodeId": "n3"},
        {"sourceNodeId": "n3", "targetNodeId": "n2"}
    ]
    res = await FlowExecutionEngine.execute(nodes, edges, {})
    assert res["status"] == "FAILED"
    assert "Maximum step limit" in res["error"]
    assert len(res["executionTrace"]) == 50
