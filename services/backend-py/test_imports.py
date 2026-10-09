import sys
import traceback

try:
    from app.models.entities import *
    import app.main
    import app.microservices.gateway
    print("✅ Every module imported cleanly (Feature Architecture Gate passed)")
except Exception as e:
    print(f"❌ Module import failed: {e}", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)
