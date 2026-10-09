import httpx
import base64
import json
import asyncio
from datetime import datetime
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives import serialization

merchant_id = "ec479308"

rsa_private_key = b"""-----BEGIN RSA PRIVATE KEY-----
MIICXQIBAAKBgQDvA1wEtP4ColOn9MMm3kGtU36nfZVEmIIsXrim/evUwqGNPgpA
nIpctP/A6t/zQCL7tMQH99xJ9BO9bM+IjkHiDeNjMHmqy0BsttVLno/gyL4jDgIZ
ezFuNhGBGUPOYvKB3paKxmJY8bOI80h6vwcgLMdZ7D78p4AE8qvaFqq9KQIDAQAB
AoGANDior0KYSR0MaCL7TI+9C9C1WIUAyxcDQgyEDcBm+Xp477JBbTKGrJDDXHQ0
8CHwQsyRFCicke/pLDcM9QoX7I8Adfo1ifob7DD7oxgekwuuoTY4dpApoc2su4k0
1kNOz71Y1lpRPQt8Z5V1NdJTkcDsgEFIZHoBIRXulh/ye7ECQQD6h+cv+FZJfxT/
ENCLZst3Y+dy1wt7CNe/pyzwD3FGPd066pucpLag3pHLiA/lStV9LgMK9Qi49fV1
gDoyTLeFAkEA9DsW1ZaDOrDMwExtIlPGGCEz684ppbDNrutRNk1+BgjZadMqKKhR
C7TIfsl+nUgnED6oP4zAKrmPyGiI+vj2VQJAM+uiX/CpgUXTBiFn9tvw4udTehtT
B8aHX/K3f3DT2ujLRoCEi2wfZSt7L6EdGjnuEKlOfCDYE+z1V8qhRPddOQJBAMNV
fy3U86A9R4WFmsOZvRYPeDdg7G5YuijsjEeiMukgqsK44T8jX669KJ4/CcVBr/yO
IIKzT/7b6uOet/ACrwECQQCrDfZm2Z6q48hDpMqm4GmrzQcaaaL15q8nZaUc8RF8
7CEETdo5g9zBy83DniyRYcl2/1oS/ppQzZQa63gKud/Y
-----END RSA PRIVATE KEY-----"""

private_key = serialization.load_pem_private_key(rsa_private_key, password=None)

def get_rsa_hash(req_time, tran_id, amount, items, return_url):
    # Try RSA signing
    hash_str = f"{req_time}{merchant_id}{tran_id}{amount}{items}{return_url}"
    signature = private_key.sign(
        hash_str.encode('utf-8'),
        padding.PKCS1v15(),
        hashes.SHA512()
    )
    return base64.b64encode(signature).decode('utf-8')

async def test_payway_rsa():
    req_time = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    tran_id = "TEST12345678"
    amount = "1.00"
    items = base64.b64encode(json.dumps([{"name": "test", "quantity": "1", "price": "1.00"}]).encode('utf-8')).decode('utf-8')
    return_url = "https://example.com/return"
    
    hash_value = get_rsa_hash(req_time, tran_id, amount, items, return_url)
    
    data = {
        "req_time": req_time,
        "merchant_id": merchant_id,
        "tran_id": tran_id,
        "amount": amount,
        "items": items,
        "hash": hash_value,
        "firstname": "John",
        "lastname": "Doe",
        "phone": "012345678",
        "email": "test@example.com",
        "return_url": return_url
    }
    
    async with httpx.AsyncClient() as client:
        url = "https://checkout-sandbox.payway.com.kh/api/payment-gateway/v1/payments/purchase"
        res = await client.post(url, data=data)
        print("Status:", res.status_code)
        print("Body:", res.text[:500])

if __name__ == "__main__":
    asyncio.run(test_payway_rsa())
