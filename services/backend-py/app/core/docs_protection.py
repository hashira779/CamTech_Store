import json
import os
from typing import Optional
from fastapi import Request, Response
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.openapi.docs import get_swagger_ui_html, get_redoc_html
from app.core.security import decode_access_token


def get_request_token(request: Request, token: Optional[str] = None) -> Optional[str]:
    """Extracts bearer or query or cookie token from request."""
    if token:
        return token.strip()
    query_token = request.query_params.get("token")
    if query_token:
        return query_token.strip()
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()
    cookie_token = request.cookies.get("camtech_docs_token") or request.cookies.get("access_token") or request.cookies.get("token")
    if cookie_token:
        return cookie_token.strip()
    return None


def is_admin_request(request: Request, token: Optional[str] = None) -> bool:
    """
    Returns True if request has valid admin credentials or is local developer environment.
    """
    # 1. Allow local developer access when not in production
    env = os.getenv("ENVIRONMENT", "development").lower()
    host = request.headers.get("host", "").split(":")[0]
    if host in ("localhost", "127.0.0.1") and env != "production":
        return True

    # 2. Validate token
    raw_token = get_request_token(request, token)
    if not raw_token:
        return False

    payload = decode_access_token(raw_token)
    if not payload:
        return False

    roles = payload.get("roles", [])
    if isinstance(roles, str):
        try:
            roles = json.loads(roles)
        except Exception:
            roles = [roles]
    if not isinstance(roles, list):
        roles = [roles]

    admin_roles = {"SUPER_ADMIN", "ORG_ADMIN", "ADMIN"}
    return any(r in admin_roles for r in roles)


def get_docs_lock_html(target_path: str = "/docs") -> str:
    """Returns a dark-mode, glassmorphic admin authorization unlock page."""
    return f"""<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Authorization Required — CamTech API Documentation</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {{
      darkMode: 'class',
      theme: {{
        extend: {{
          fontFamily: {{
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          }},
        }}
      }}
    }}
  </script>
</head>
<body class="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased flex items-center justify-center p-4 relative overflow-hidden selection:bg-indigo-500 selection:text-white">
  
  <!-- Ambient background glow -->
  <div class="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-r from-blue-600/20 via-indigo-600/25 to-purple-600/20 blur-[120px] rounded-full"></div>

  <div class="relative w-full max-w-md bg-zinc-900/80 border border-zinc-800 backdrop-blur-2xl rounded-2xl p-8 shadow-2xl">
    <div class="flex items-center gap-3 mb-6">
      <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(245,158,11,0.4)]">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div>
        <h1 class="text-lg font-bold text-white tracking-tight">Restricted API Access</h1>
        <p class="text-xs text-zinc-400">CamTech Universal Enterprise Gateway</p>
      </div>
    </div>

    <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-6 flex items-start gap-2.5">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-amber-400 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" x2="12" y1="8" y2="12"/>
        <line x1="12" x2="12.01" y1="16" y2="16"/>
      </svg>
      <p class="text-xs text-amber-200/90 leading-relaxed">
        Interactive documentation (Swagger UI & ReDoc) and OpenAPI schemas are protected. You must be an authorized administrator (<code class="font-mono text-amber-300">ORG_ADMIN</code> or <code class="font-mono text-amber-300">SUPER_ADMIN</code>) to view them.
      </p>
    </div>

    <form id="authForm" onsubmit="handleAuth(event)" class="space-y-4">
      <div>
        <label for="adminToken" class="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
          Admin JWT Access Token
        </label>
        <textarea
          id="adminToken"
          rows="3"
          placeholder="Paste your Bearer token here..."
          class="w-full bg-zinc-950/80 border border-zinc-700/80 rounded-xl px-3.5 py-2.5 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
          required
        ></textarea>
      </div>

      <div id="errorMsg" class="hidden text-xs font-medium text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2.5"></div>

      <button
        type="submit"
        id="submitBtn"
        class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-indigo-500/20 hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Unlock Documentation</span>
      </button>
    </form>

    <div class="mt-6 pt-5 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
      <a href="/" class="hover:text-zinc-200 transition-colors">← Gateway Status</a>
      <a href="https://adminconsol.camtech.cam" class="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Admin Console →</a>
    </div>
  </div>

  <script>
    function handleAuth(e) {{
      e.preventDefault();
      const token = document.getElementById('adminToken').value.trim();
      const errorMsg = document.getElementById('errorMsg');
      if (!token) return;

      // Save token as session cookie
      document.cookie = `camtech_docs_token=${{encodeURIComponent(token)}}; path=/; max-age=86400; SameSite=Lax; Secure`;
      
      // Redirect to the target docs page with token query
      const url = new URL(window.location.href);
      url.searchParams.set('token', token);
      window.location.href = url.toString();
    }}
  </script>
</body>
</html>
"""
