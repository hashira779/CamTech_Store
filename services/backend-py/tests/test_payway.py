import pytest
import hmac
import hashlib
import base64
from unittest.mock import patch, AsyncMock
from app.core.payway import PaywayService

def test_aba_hash_calculation():
    """
    Verifies that the HMAC-SHA512 hash calculation matches the official
    ABA PayWay Developer Suite specification:
    b4hash = req_time + merchant_id + tran_id + amount + items + first_name + last_name
             + email + phone + purchase_type + payment_option + callback_url + return_deeplink
             + currency + custom_fields + return_params + payout + lifetime + qr_image_template
    """
    api_key = "test_api_key_123"
    req_time = "20261010010000"
    merchant_id = "test_merchant"
    tran_id = "tran_001"
    amount = "10.00"
    items = "W1tdXQ=="
    first_name = "Valued"
    last_name = "Customer"
    email = "test@camtech.cam"
    phone = "012345678"
    purchase_type = "purchase"
    payment_option = "abapay_khqr"
    callback_url = "aHR0cHM6Ly9leGFtcGxlLmNvbQ=="
    return_deeplink = ""
    currency = "USD"
    custom_fields = ""
    return_params = ""
    payout = ""
    lifetime = "15"
    qr_image_template = "template3_color"

    expected_b4hash = (
        f"{req_time}{merchant_id}{tran_id}{amount}{items}"
        f"{first_name}{last_name}{email}{phone}"
        f"{purchase_type}{payment_option}{callback_url}{return_deeplink}"
        f"{currency}{custom_fields}{return_params}{payout}"
        f"{lifetime}{qr_image_template}"
    )

    expected_hash = base64.b64encode(
        hmac.new(api_key.encode("utf-8"), expected_b4hash.encode("utf-8"), hashlib.sha512).digest()
    ).decode("utf-8")

    computed_hash = PaywayService.calculate_aba_hash(
        api_key=api_key,
        req_time=req_time,
        merchant_id=merchant_id,
        tran_id=tran_id,
        amount=amount,
        items=items,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
        purchase_type=purchase_type,
        payment_option=payment_option,
        callback_url=callback_url,
        return_deeplink=return_deeplink,
        currency=currency,
        custom_fields=custom_fields,
        return_params=return_params,
        payout=payout,
        lifetime=lifetime,
        qr_image_template=qr_image_template,
    )

    assert computed_hash == expected_hash

@pytest.mark.asyncio
async def test_payway_fallback_to_bakong_khqr():
    """
    Verifies that when ABA credentials are unconfigured or ABA API fails,
    PaywayService generates a verified EMVCo Bakong KHQR code with scannable QR image.
    """
    res = await PaywayService.generate_qr(
        merchant_id="unconfigured",
        api_key="unconfigured",
        transaction_id="TX-TEST-001",
        amount=5.50,
        currency="USD",
    )

    assert res["success"] is True
    assert res["source"] == "BAKONG_KHQR"
    assert "qr_string" in res and res["qr_string"].startswith("000201")
    assert "qr_image" in res and len(res["qr_image"]) > 100
    assert res["status"] == "PENDING"

@pytest.mark.asyncio
async def test_payway_api_success_handling():
    """
    Verifies handling when official ABA PayWay API returns code 0 / Success.
    """
    mock_response = {
        "status": {"code": "0", "message": "Success."},
        "qrString": "00020101021230510016abaakhppxxx@abaa...",
        "qrImage": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==",
        "abapay_deeplink": "abamobilebank://ababank.com?type=payway&qrcode=000201...",
    }

    with patch("httpx.AsyncClient.post") as mock_post:
        mock_post.return_value = AsyncMock(
            status_code=200,
            json=lambda: mock_response,
        )

        res = await PaywayService.generate_qr(
            merchant_id="ec000001",
            api_key="valid_key",
            transaction_id="TX-TEST-002",
            amount=10.00,
            currency="USD",
        )

        assert res["success"] is True
        assert res["source"] == "ABA_PAYWAY"
        assert res["qr_string"] == mock_response["qrString"]
        assert res["qr_image"] == "iVBORw0KGgoAAAANSUhEUg=="
        assert res["abapay_deeplink"] == mock_response["abapay_deeplink"]
