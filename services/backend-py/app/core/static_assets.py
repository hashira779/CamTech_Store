# ==============================================================================
# Static assets for the HTML pages backend-py renders itself
# ==============================================================================
# The gateway dashboard (/) and the admin docs unlock page (/docs, /redoc) are
# server-rendered. They used to pull the Tailwind Play CDN at runtime, which the
# Cross-Origin-Embedder-Policy: require-corp response header blocks outright —
# cdn.tailwindcss.com sends no Cross-Origin-Resource-Policy header, so the
# browser drops the script and both pages render completely unstyled.
#
# The CSS is now compiled ahead of time and served from 'self'. Rebuild it after
# changing classes in either page:
#   pnpm py:build:css
# ==============================================================================

from hashlib import sha256
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

# app/core/static_assets.py -> app/static
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

_CSS_RELATIVE = "css/gateway.css"
_CSS_PATH = STATIC_DIR / _CSS_RELATIVE


def _fingerprinted_css_url() -> str:
    """URL for the compiled CSS, fingerprinted so a rebuild busts the browser's
    and Cloudflare's cache instead of serving the previous build."""
    try:
        digest = sha256(_CSS_PATH.read_bytes()).hexdigest()[:12]
    except OSError:
        # A missing build artifact should degrade to an unstyled page, never a
        # 500 on the gateway's landing page or the docs lock screen.
        return f"/static/{_CSS_RELATIVE}"
    return f"/static/{_CSS_RELATIVE}?v={digest}"


GATEWAY_CSS_URL = _fingerprinted_css_url()


def mount_static(app: FastAPI) -> None:
    """Mount /static on ``app``.

    Must be called before any catch-all route is registered — Starlette matches
    routes in registration order, so the gateway's ``/{path:path}`` proxy would
    otherwise swallow every /static request and forward it to a microservice.
    """
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
