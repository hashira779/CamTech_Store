import os
import json
import hmac
import hashlib
import base64
import httpx
from datetime import datetime, timezone
from typing import Dict, Any, List

class PaywayService:
    @staticmethod
    def get_hash(api_key: str, merchant_id: str, req_time: str, tran_id: str, amount: str, items: str, firstname: str, lastname: str, email: str, phone: str, return_url: str) -> str:
        # According to ABA PayWay HMAC-SHA512 standard.
        hash_str = f"{req_time}{merchant_id}{tran_id}{amount}{items}{firstname}{lastname}{email}{phone}{return_url}"
        h = hmac.new(api_key.encode('utf-8'), hash_str.encode('utf-8'), hashlib.sha512)
        return base64.b64encode(h.digest()).decode('utf-8')

    @staticmethod
    async def generate_qr(merchant_id: str, api_key: str, transaction_id: str, amount: float, items: List[Dict[str, Any]] = None, 
                          firstname: str = "", lastname: str = "", email: str = "", phone: str = "", 
                          return_url: str = "", is_production: bool = False) -> dict:
        """
        Generate a dynamic KHQR for the given transaction using Payway API.
        """
        req_time = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        amount_str = f"{float(amount):.2f}"
        
        if items is None:
            items = []
            
        items_b64 = base64.b64encode(json.dumps(items).encode('utf-8')).decode('utf-8')
        
        hash_value = PaywayService.get_hash(api_key, merchant_id, req_time, transaction_id, amount_str, items_b64, firstname, lastname, email, phone, return_url)
        
        data = {
            "req_time": req_time,
            "merchant_id": merchant_id,
            "tran_id": transaction_id,
            "amount": amount_str,
            "items": items_b64,
            "hash": hash_value,
            "firstname": firstname,
            "lastname": lastname,
            "phone": phone,
            "email": email,
            "return_url": return_url
        }
        
        api_url = "https://checkout.payway.com.kh/api/payment-gateway/v1/payments/purchase" if is_production else "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase"
        
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(api_url, data=data)
                res.raise_for_status()
                res_data = res.json()
                
                if "qrString" in res_data:
                    return {
                        "success": True,
                        "qr_string": res_data.get("qrString"),
                        "qr_image": res_data.get("qrImage"),
                        "abapay_deeplink": res_data.get("abapay_deeplink", ""),
                        "status": "PENDING"
                    }
                else:
                    return {
                        "success": False,
                        "error": str(res_data)
                    }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def verify_transaction(merchant_id: str, api_key: str, tran_id: str, is_production: bool = False) -> bool:
        """
        Fraud Prevention: Instead of trusting the incoming webhook pushback blindly,
        we proactively ping ABA PayWay Check Transaction API to confirm the actual status.
        """
        if not tran_id:
            return False
            
        req_time = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        hash_str = f"{req_time}{merchant_id}{tran_id}"
        h = hmac.new(api_key.encode('utf-8'), hash_str.encode('utf-8'), hashlib.sha512)
        hash_value = base64.b64encode(h.digest()).decode('utf-8')
        
        check_url = "https://checkout.payway.com.kh/api/payment-gateway/v1/payments/check-transaction" if is_production else "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/check-transaction"
        
        data = {
            "req_time": req_time,
            "merchant_id": merchant_id,
            "tran_id": tran_id,
            "hash": hash_value
        }
        
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(check_url, data=data)
                res.raise_for_status()
                res_data = res.json()
                
                if str(res_data.get("status")) == "0" or res_data.get("status") == 0:
                    return True
                return False
        except Exception as e:
            print(f"Error checking transaction: {e}")
            return False

payway_service = PaywayService()
