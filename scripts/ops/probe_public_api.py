import urllib.request
import urllib.error
import json

base_url = "https://adminconsol.camtech.cam"
routes = [
    "/api/v1/auth/me",
    "/api/v1/delivery/tasks",
    "/api/v1/delivery/auth/telegram",
    "/api/v1/products",
    "/api/v1/sales",
    "/api/v1/hr/employees",
    "/api/v1/bot-builder/bots",
    "/api/v1/platform/health",
    "/health",
    "/api/v1/organizations",
]

for r in routes:
    url = base_url + r
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"{r} -> {resp.status} : {resp.read()[:100].decode(errors='replace')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors='replace')
        print(f"{r} -> HTTP {e.code} : {body[:150]}")
    except Exception as e:
        print(f"{r} -> Error: {e}")
