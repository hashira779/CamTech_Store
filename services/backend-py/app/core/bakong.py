import hashlib
import io
import base64
import logging
from typing import Optional, Dict, Any
import httpx

try:
    import qrcode
except ImportError:
    qrcode = None

from app.domain.commerce_engines import KhqrGenerator

logger = logging.getLogger(__name__)

BAKONG_API_BASE = "https://api-bakong.nbc.gov.kh"

class BakongService:
    """
    Official NBC Bakong Open API Client & KHQR Engine.
    Implements the National Bank of Cambodia Open API Document v1.0.2:
    - Dynamic KHQR generation (EMVCo CRC-16)
    - Deeplink generation via /v1/generate_deeplink_by_qr
    - Transaction status verification via /v1/check_transaction_by_md5
    - Account verification via /v1/check_bakong_account
    """

    @classmethod
    def get_token(cls) -> str:
        # Secrets come from the environment only (never a literal in Git); empty means "not configured".
        import os
        return os.getenv("BAKONG_AUTH_TOKEN", "").strip()

    @classmethod
    def get_api_url(cls) -> str:
        import os
        return os.getenv("BAKONG_API_URL", BAKONG_API_BASE).rstrip("/")

    @classmethod
    def generate_khqr(
        cls,
        merchant_name: str,
        account_id: str,
        amount: float,
        currency: str = "USD",
        merchant_city: str = "Phnom Penh",
        bill_number: Optional[str] = None,
        expires_in_seconds: int = 900,
        account_type: str = "INDIVIDUAL",
        merchant_id: Optional[str] = None,
        acquiring_bank: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generates a dynamic KHQR entirely locally (zero-API rule): EMVCo string, PNG image and the
        MD5 used later for reconciliation. Bakong is contacted only to verify payment, never to issue a QR.
        """
        if not account_id:
            # Never fall back to a platform account: the store's customers must pay the store.
            return {"success": False, "message": "Bakong account is not configured for this store."}
        try:
            khqr = KhqrGenerator.generate_dynamic_qr(
                merchant_name=merchant_name,
                account_id=account_id,
                amount=amount,
                currency=currency,
                merchant_city=merchant_city,
                bill_number=bill_number,
                expires_in_seconds=expires_in_seconds,
                account_type=account_type,
                merchant_id=merchant_id,
                acquiring_bank=acquiring_bank,
            )
        except ValueError as e:
            return {"success": False, "message": str(e)}

        qr_string = khqr["qrString"]
        qr_b64 = ""
        if qrcode is not None:
            img = qrcode.make(qr_string)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        return {
            "success": True,
            "source": "BAKONG_KHQR",
            "qr_string": qr_string,
            "qr_image": qr_b64,
            "md5": khqr["md5"],
            "deeplink": None,
            "account_id": account_id,
            "amount": khqr["amount"],
            "currency": khqr["currency"],
            "expires_at_ms": khqr["expiresAtMs"],
        }

    @staticmethod
    def _classify_failure(http_status: Optional[int], body: Optional[dict]) -> Dict[str, Any]:
        """
        Maps an NBC Open API failure (v1.0.2 §II status/error codes) to a stable reason + actionable message.
        reason: TOKEN | NOT_FOUND | NOT_PAID | RATE_LIMITED | UNREACHABLE | FAILED
        """
        code = (body or {}).get("errorCode")
        nbc_msg = (body or {}).get("responseMessage")
        if http_status in (401, 403) or code == 6:
            return {"reason": "TOKEN", "errorCode": code,
                    "message": "Bakong API token is invalid or expired. Renew it (NBC /v1/renew_token) and enter the new token."}
        if http_status == 429:
            return {"reason": "RATE_LIMITED", "errorCode": code,
                    "message": "Bakong API rate limit reached. Try again in a few minutes."}
        if code == 11:
            return {"reason": "NOT_FOUND", "errorCode": code,
                    "message": "This Bakong Account ID does not exist. Copy it exactly from your Bakong app (name@bank)."}
        if code == 1:
            return {"reason": "NOT_PAID", "errorCode": code, "message": "Payment not received yet."}
        if code == 3:
            return {"reason": "FAILED", "errorCode": code, "message": "The Bakong transaction failed."}
        if http_status is None or http_status >= 500 or code == 9:
            return {"reason": "UNREACHABLE", "errorCode": code,
                    "message": "Could not reach the Bakong network. Please try again shortly."}
        return {"reason": "FAILED", "errorCode": code, "message": nbc_msg or f"Bakong API error (HTTP {http_status})"}

    @staticmethod
    def test_accounts_allowed() -> bool:
        """`*@test` / `*@mock` accounts are accepted without calling NBC only when explicitly enabled (local/CI)."""
        import os
        return os.getenv("BAKONG_ALLOW_TEST_ACCOUNTS", "").strip() == "1"

    @classmethod
    async def check_bakong_account(cls, account_id: str, token: Optional[str] = None) -> Dict[str, Any]:
        """
        Checks that a Bakong Account ID exists (/v1/check_bakong_account).
        Per NBC spec v1.0.2 the success response carries `data: null` — there is NO owner name to read;
        the merchant name must come from the store (as shown in its Bakong app).
        Returns {valid, reason?, errorCode?, message}.
        """
        if not account_id:
            return {"valid": False, "reason": "FAILED", "message": "Account ID is required"}

        acc_clean = account_id.strip().lower()
        if (acc_clean.endswith("@mock") or acc_clean.endswith("@test")) and cls.test_accounts_allowed():
            return {"valid": True, "message": "Test account accepted (BAKONG_ALLOW_TEST_ACCOUNTS=1)"}

        auth_token = token or cls.get_token()
        if not auth_token:
            return {"valid": False, "reason": "TOKEN",
                    "message": "A Bakong API token is required to verify the account. Enter your store's token from NBC Open API."}
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        }
        api_url = f"{cls.get_api_url()}/v1/check_bakong_account"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(api_url, headers=headers, json={"accountId": account_id.strip()})
        except Exception as e:
            logger.error("Error calling check_bakong_account: %s", e)
            return {"valid": False, **cls._classify_failure(None, None)}

        try:
            body = res.json()
        except ValueError:
            body = None
        if res.status_code == 200 and isinstance(body, dict) and body.get("responseCode") == 0:
            return {"valid": True, "message": body.get("responseMessage") or "Account ID exists"}
        if res.status_code == 200 and isinstance(body, dict) and body.get("responseCode") == 1 and body.get("errorCode") is None:
            body = {**body, "errorCode": 11}  # spec: responseCode 1 = account does not exist
        return {"valid": False, **cls._classify_failure(res.status_code, body if isinstance(body, dict) else None)}

    @classmethod
    async def check_transaction_by_md5(cls, md5_hash: str, token: Optional[str] = None) -> Dict[str, Any]:
        """
        Verify transaction status using Bakong Open API (/v1/check_transaction_by_md5).
        Returns dict with:
        - verified: bool
        - data: Optional[Dict]
        - message: str
        """
        if not md5_hash:
            return {"verified": False, "message": "No MD5 hash provided"}

        auth_token = token or cls.get_token()
        if not auth_token:
            # Fail closed: without a token we cannot prove payment, so the order must stay unpaid.
            return {"verified": False, "message": "Bakong API token is not configured (BAKONG_AUTH_TOKEN)."}
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        }
        api_url = f"{cls.get_api_url()}/v1/check_transaction_by_md5"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(api_url, headers=headers, json={"md5": md5_hash})
        except Exception as e:
            logger.error("Error calling Bakong check_transaction_by_md5: %s", e)
            return {"verified": False, **cls._classify_failure(None, None)}

        try:
            body = res.json()
        except ValueError:
            body = None
        # responseCode 0 = transaction found and settled; data carries hash, from/toAccountId, currency, amount.
        if res.status_code == 200 and isinstance(body, dict) and body.get("responseCode") == 0 and body.get("data"):
            return {"verified": True, "data": body["data"], "message": body.get("responseMessage") or "Transaction confirmed"}
        failure = cls._classify_failure(res.status_code, body if isinstance(body, dict) else None)
        if failure["reason"] == "TOKEN":
            logger.error("Bakong token rejected while checking md5 %s — payments cannot be confirmed until it is renewed", md5_hash)
        return {"verified": False, "data": None, **failure}

bakong_service = BakongService()
