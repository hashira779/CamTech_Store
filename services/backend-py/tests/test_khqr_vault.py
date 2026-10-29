"""KHQR local generation, merchant secret vault, and Bakong webhook signature."""
import base64
import os

import pytest

from app.core import key_vault
from app.core.config import settings
from app.domain.commerce_engines import KhqrGenerator


@pytest.fixture
def kek(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_KEK", base64.b64encode(os.urandom(32)).decode(), raising=False)


# ---------------------------------------------------------------- KHQR

def test_khqr_layout_and_crc():
    q = KhqrGenerator.generate_dynamic_qr("Coffee Lab", "coffeelab@aclb", 4.5, "USD", bill_number="ORD-1", created_at_ms=1_700_000_000_000)
    tags = KhqrGenerator.parse(q["qrString"])  # raises on CRC mismatch
    assert tags["00"] == "01" and tags["01"] == "12"
    assert tags["29"]["00"] == "coffeelab@aclb"  # the paying app sends funds to 29/00
    assert tags["53"] == "840" and tags["54"] == "4.50" and tags["58"] == "KH"
    assert tags["62"]["01"] == "ORD-1"
    assert tags["99"]["00"] == "1700000000000" and int(tags["99"]["01"]) > 1_700_000_000_000
    assert len(q["md5"]) == 32


def test_khqr_matches_nbc_sample_account_layout():
    """NBC Open API v1.0.2 sample QR carries the account as tag 29 / subtag 00 ("29190015gg_hh_1980@amkb")."""
    tags = KhqrGenerator.parse(KhqrGenerator.generate_dynamic_qr("Gg H", "gg_hh_1980@amkb", 1, "USD")["qrString"])
    assert tags["29"] == {"00": "gg_hh_1980@amkb"}


def test_khqr_merchant_account_uses_tag_30():
    q = KhqrGenerator.generate_dynamic_qr("Coffee Lab", "coffee_lab@aclb", 2, "USD",
                                          account_type="MERCHANT", merchant_id="MID-000123", acquiring_bank="ACLEDA Bank")
    tags = KhqrGenerator.parse(q["qrString"])
    assert "29" not in tags
    assert tags["30"] == {"00": "coffee_lab@aclb", "01": "MID-000123", "02": "ACLEDA Bank"}


def test_khqr_merchant_requires_merchant_id_and_bank():
    with pytest.raises(ValueError):
        KhqrGenerator.generate_dynamic_qr("Shop", "shop@aclb", 1, "USD", account_type="MERCHANT", merchant_id="M1")


def test_khqr_khr_has_no_minor_unit():
    tags = KhqrGenerator.parse(KhqrGenerator.generate_dynamic_qr("Shop", "shop@wing", 20500.4, "KHR")["qrString"])
    assert tags["53"] == "116" and tags["54"] == "20500"


def test_khqr_same_amount_different_orders_have_different_md5():
    a = KhqrGenerator.generate_dynamic_qr("Shop", "shop@wing", 5, "USD", bill_number="ORD-A", created_at_ms=1)
    b = KhqrGenerator.generate_dynamic_qr("Shop", "shop@wing", 5, "USD", bill_number="ORD-B", created_at_ms=1)
    assert a["md5"] != b["md5"]


@pytest.mark.parametrize("kwargs", [
    {"account_id": ""}, {"account_id": "no-bank-suffix"}, {"amount": 0}, {"currency": "EUR"},
])
def test_khqr_rejects_invalid_input(kwargs):
    args = {"merchant_name": "Shop", "account_id": "shop@wing", "amount": 1, "currency": "USD", **kwargs}
    with pytest.raises(ValueError):
        KhqrGenerator.generate_dynamic_qr(**args)


def test_khqr_crc_tamper_detected():
    s = KhqrGenerator.generate_dynamic_qr("Shop", "shop@wing", 1, "USD")["qrString"]
    tampered = s.replace("54041.00", "54049.00", 1)  # change the amount, keep the old CRC
    assert tampered != s
    with pytest.raises(ValueError):
        KhqrGenerator.parse(tampered)


# ---------------------------------------------------------------- Vault

def test_vault_roundtrip_and_mask(kek):
    env = key_vault.seal("bk_live_secret_token_9f3a", "org-a")
    assert "bk_live_secret_token" not in str(env)
    assert key_vault.open_sealed(env, "org-a") == "bk_live_secret_token_9f3a"
    assert key_vault.mask(env) == "bk_live_••••••••9f3a"


def test_vault_is_bound_to_organization(kek):
    env = key_vault.seal("branch-a-secret-123", "org-a")
    with pytest.raises(key_vault.VaultIntegrityError):
        key_vault.open_sealed(env, "org-b")


def test_vault_detects_tampering(kek):
    env = key_vault.seal("branch-a-secret-123", "org-a")
    ct = bytearray(base64.b64decode(env["encryptedKey"]))
    ct[0] ^= 1
    with pytest.raises(key_vault.VaultIntegrityError):
        key_vault.open_sealed({**env, "encryptedKey": base64.b64encode(bytes(ct)).decode()}, "org-a")


def test_vault_fails_closed_without_kek(monkeypatch):
    monkeypatch.setattr(settings, "PAYMENT_KEK", "", raising=False)
    monkeypatch.delenv("PAYMENT_KEK", raising=False)
    with pytest.raises(key_vault.VaultUnavailable):
        key_vault.seal("x" * 12, "org-a")


def test_vault_rejects_wrong_kek(kek, monkeypatch):
    env = key_vault.seal("branch-a-secret-123", "org-a")
    monkeypatch.setattr(settings, "PAYMENT_KEK", base64.b64encode(os.urandom(32)).decode(), raising=False)
    with pytest.raises(key_vault.VaultIntegrityError):
        key_vault.open_sealed(env, "org-a")


# ---------------------------------------------------------------- Webhook signature

def test_webhook_signature_is_hmac_sha256_over_timestamp_and_body():
    import hashlib
    import hmac
    from app.modules.sales.controllers.checkout_controller import bakong_webhook_signature
    body = b'{"md5":"abc"}'
    expected = hmac.new(b"whsec", b"1700000000." + body, hashlib.sha256).hexdigest()
    assert bakong_webhook_signature("whsec", "1700000000", body) == expected
    assert bakong_webhook_signature("other", "1700000000", body) != expected
