# ==============================================================================
# CamTech Universal Enterprise API Gateway Dashboard
# Hardened, Cloudflare-Themed Edge Operations Console (2026-2030 Standard)
# Zero critical info leakage: Internal ports, container names, and credentials redacted.
# ==============================================================================

from app.core.static_assets import GATEWAY_CSS_URL


def get_gateway_dashboard_html() -> str:
    return _DASHBOARD_TEMPLATE.replace("__CSS_URL__", GATEWAY_CSS_URL)


_DASHBOARD_TEMPLATE = """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CamTech Enterprise Edge Network — Cloudflare Protected Gateway</title>
  <link rel="stylesheet" href="__CSS_URL__">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --cf-orange: #F38020;
      --cf-orange-hover: #FA8B28;
      --cf-orange-glow: rgba(243, 128, 32, 0.25);
      --cf-dark: #0B0F19;
      --cf-card: #111827;
      --cf-border: rgba(255, 255, 255, 0.08);
      --cf-border-hover: rgba(243, 128, 32, 0.4);
    }
    body {
      background-color: var(--cf-dark);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .cf-gradient-text {
      background: linear-gradient(135deg, #FFFFFF 30%, #F38020 80%, #FA8B28 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cf-orange-btn {
      background: linear-gradient(135deg, #F38020 0%, #E56E10 100%);
      box-shadow: 0 4px 20px -2px rgba(243, 128, 32, 0.45);
      transition: all 0.2s ease;
    }
    .cf-orange-btn:hover {
      background: linear-gradient(135deg, #FA8B28 0%, #F38020 100%);
      box-shadow: 0 6px 25px -1px rgba(243, 128, 32, 0.6);
      transform: translateY(-1px);
    }
    .cf-card {
      background: rgba(17, 24, 39, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid var(--cf-border);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .cf-card:hover {
      border-color: var(--cf-border-hover);
      box-shadow: 0 10px 30px -10px rgba(243, 128, 32, 0.15);
      transform: translateY(-2px);
    }
    .cf-pill {
      background: rgba(243, 128, 32, 0.1);
      border: 1px solid rgba(243, 128, 32, 0.25);
      color: #F38020;
    }
  </style>
</head>
<body class="min-h-screen text-zinc-100 antialiased relative overflow-x-hidden selection:bg-[#F38020] selection:text-white">

  <!-- Cloudflare Ambient Radial Atmosphere -->
  <div class="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2 w-[1100px] h-[500px] bg-gradient-to-r from-[#F38020]/15 via-amber-600/10 to-purple-700/10 blur-[150px] rounded-full"></div>
  <div class="pointer-events-none absolute top-[700px] -right-48 w-[600px] h-[450px] bg-gradient-to-tr from-[#F38020]/10 via-amber-500/10 to-transparent blur-[140px] rounded-full"></div>

  <!-- Header Bar -->
  <header class="sticky top-0 z-50 backdrop-blur-xl bg-[#0B0F19]/80 border-b border-zinc-800/80">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      
      <!-- Brand & Cloudflare Edge Logo -->
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F38020] to-[#D96B10] flex items-center justify-center text-white shadow-[0_0_20px_rgba(243,128,32,0.45)]">
          <svg class="w-5 h-5 text-white fill-current" viewBox="0 0 24 24">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-base tracking-tight text-white">CamTech Edge Network</span>
            <span class="cf-pill text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">Cloudflare Edge</span>
          </div>
          <p class="text-[11px] text-zinc-400 font-mono hidden sm:block">Global API Reverse Proxy & Microservices Mesh</p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 sm:gap-3">
        <a href="/health" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-medium border border-emerald-500/25 hover:bg-emerald-500/20 transition">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Edge Status</span>
        </a>
        <a href="https://adminconsol.camtech.cam" target="_blank" class="cf-orange-btn inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-white text-xs font-bold transition">
          <span>Admin Portal</span>
          <span>→</span>
        </a>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-20 relative z-10">
    <div class="text-center max-w-3xl mx-auto space-y-4">
      
      <!-- Cloudflare Security Pill -->
      <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300 shadow-inner">
        <span class="w-2 h-2 rounded-full bg-[#F38020] animate-ping"></span>
        <span class="text-[#F38020] font-semibold">Cloudflare WAF Active</span>
        <span class="text-zinc-600">•</span>
        <span class="text-emerald-400">All Systems Operational</span>
      </div>

      <!-- Main Headline -->
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight">
        Enterprise Cloud-Native <br class="hidden sm:inline"/>
        <span class="cf-gradient-text">API Command Center</span>
      </h1>

      <p class="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto font-normal">
        Zero-downtime edge gateway routing inbound requests across isolated domain microservices with automated DDoS mitigation, granular rate limiting, and global edge acceleration.
      </p>

      <!-- Primary Action Buttons -->
      <div class="flex flex-wrap items-center justify-center gap-3.5 pt-2">
        <a href="https://adminconsol.camtech.cam" target="_blank" class="cf-orange-btn px-6 py-3 rounded-xl text-white font-bold text-sm transition flex items-center gap-2 cursor-pointer">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
          <span>Sign In to Admin Portal</span>
          <span>→</span>
        </a>
        <a href="/health" class="px-5 py-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 font-semibold text-sm border border-zinc-800/90 transition flex items-center gap-2">
          <span>Verify Edge Health</span>
        </a>
      </div>

      <!-- Ray ID & Colocation Info Bar -->
      <div class="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-zinc-500">
        <span class="flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Edge PoP: <strong class="text-zinc-300">PNH / SIN (Cloudflare Anycast)</strong>
        </span>
        <span>•</span>
        <span>Security: <strong class="text-[#F38020]">TLS 1.3 Strict Mode</strong></span>
        <span>•</span>
        <span>DDoS Shield: <strong class="text-emerald-400">Armed (Active)</strong></span>
      </div>
    </div>

    <!-- Cloudflare Analytics KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 mb-12">
      <div class="cf-card p-4 rounded-2xl">
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Edge Availability</div>
        <div class="text-2xl font-extrabold text-white mt-1 font-mono">99.99% SLA</div>
        <div class="text-xs text-emerald-400 font-mono mt-0.5 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Zero-Downtime Mesh
        </div>
      </div>

      <div class="cf-card p-4 rounded-2xl">
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Edge Protection</div>
        <div class="text-2xl font-extrabold text-white mt-1 font-mono">Cloudflare WAF</div>
        <div class="text-xs text-[#F38020] font-mono mt-0.5 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-[#F38020]"></span> Rate Limiting & Bot Shield
        </div>
      </div>

      <div class="cf-card p-4 rounded-2xl">
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Edge Latency</div>
        <div class="text-2xl font-extrabold text-white mt-1 font-mono">&lt; 35ms P95</div>
        <div class="text-xs text-amber-300 font-mono mt-0.5 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> HTTP/2 & Smart Routing
        </div>
      </div>

      <div class="cf-card p-4 rounded-2xl">
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Security Architecture</div>
        <div class="text-2xl font-extrabold text-white mt-1 font-mono">Zero Trust</div>
        <div class="text-xs text-cyan-400 font-mono mt-0.5 flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full bg-cyan-400"></span> Cryptographic JWT Isolation
        </div>
      </div>
    </div>

    <!-- Microservices Mesh Capabilities (Hardened Cloudflare Route Rules Layout) -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>Active Microservices Mesh</span>
            <span class="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">7 Verified Routes</span>
          </h2>
          <p class="text-xs text-zinc-400">High-availability domain microservices running behind Cloudflare Edge Gateway</p>
        </div>
        <div class="text-xs font-mono text-zinc-400 hidden sm:block">
          Network Protocol: <span class="text-[#F38020]">REST • SSE • WebSockets</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        <!-- Service 1 -->
        <div class="cf-card p-5 rounded-2xl flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Route
              </span>
              <span class="text-[11px] font-mono text-zinc-500">Identity Domain</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Auth & Access Control</h3>
            <p class="text-xs text-zinc-400 mt-1">Multi-tenant provisioning, cryptographic JWT issuance, session validation, and granular role-based permissions.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">RBAC Security</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Multi-Tenant</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Audit Trail</span>
          </div>
        </div>

        <!-- Service 2 -->
        <div class="cf-card p-5 rounded-2xl flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Route
              </span>
              <span class="text-[11px] font-mono text-zinc-500">Catalog Domain</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Catalog & Products Engine</h3>
            <p class="text-xs text-zinc-400 mt-1">High-throughput product matrix, SKU variant hierarchies, dynamic pricing rules, and multi-location inventory synchronization.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Product Matrix</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Barcode Engine</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Tiered Edge Cache</span>
          </div>
        </div>

        <!-- Service 3 -->
        <div class="cf-card p-5 rounded-2xl flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Route
              </span>
              <span class="text-[11px] font-mono text-zinc-500">Commerce Domain</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Sales & Commerce Service</h3>
            <p class="text-xs text-zinc-400 mt-1">POS register settlement, storefront transactions, Bakong KHQR dynamic QR generation, and customer loyalty points.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Omnichannel POS</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Bakong KHQR</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Loyalty Rewards</span>
          </div>
        </div>

        <!-- Service 4 -->
        <div class="cf-card p-5 rounded-2xl flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Route
              </span>
              <span class="text-[11px] font-mono text-zinc-500">Logistics Domain</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Delivery & Logistics Service</h3>
            <p class="text-xs text-zinc-400 mt-1">Courier dispatch orchestration, live GPS telemetry streaming, proof of delivery verification, and cash-on-delivery balancing.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Fleet Dispatch</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Live Telemetry</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Proof of Delivery</span>
          </div>
        </div>

        <!-- Service 5 -->
        <div class="cf-card p-5 rounded-2xl flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Route
              </span>
              <span class="text-[11px] font-mono text-zinc-500">HR Domain</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Workforce & Human Capital</h3>
            <p class="text-xs text-zinc-400 mt-1">Enterprise organizational structures, staff directory, attendance shifts, and automated payroll operations.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Staff Directory</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Leave Tracking</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Encrypted Payroll</span>
          </div>
        </div>

        <!-- Service 6 -->
        <div class="cf-card p-5 rounded-2xl flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Route
              </span>
              <span class="text-[11px] font-mono text-zinc-500">Finance Domain</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Finance & General Ledger</h3>
            <p class="text-xs text-zinc-400 mt-1">Double-entry accounting, multi-currency conversions, automated journal reconciliations, and tax compliance reporting.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Double-Entry Ledger</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Multi-Currency</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Tax & Audit Ready</span>
          </div>
        </div>

        <!-- Service 7 -->
        <div class="cf-card p-5 rounded-2xl flex flex-col justify-between gap-3 md:col-span-2 lg:col-span-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active Route
              </span>
              <span class="text-[11px] font-mono text-zinc-500">Platform Domain</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Platform, Copilot & Event Outbox</h3>
            <p class="text-xs text-zinc-400 mt-1">High-throughput event bus, real-time push notification dispatches, transactional outbox delivery, and AI platform integrations.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Event Mesh</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">Push Notifications</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900/90 text-zinc-300 border border-zinc-800">AI Platform Integration</span>
          </div>
        </div>

      </div>
    </div>

    <!-- Quick Edge Verification Probe -->
    <div class="mt-12 p-6 rounded-2xl bg-[#111827]/80 border border-zinc-800 font-mono text-xs shadow-xl">
      <div class="flex items-center justify-between pb-3 border-b border-zinc-800 text-zinc-400">
        <span class="flex items-center gap-2">
          <svg class="w-4 h-4 text-[#F38020] fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14h2v2h-2zm0-10h2v8h-2z"/>
          </svg>
          Quick Edge Health Probe
        </span>
        <span class="text-[#F38020]">HTTP/2 TLS 1.3</span>
      </div>
      <div class="mt-3 p-3.5 rounded-xl bg-[#0B0F19] text-zinc-300 border border-zinc-800/80 overflow-x-auto select-all">
        <code>curl -sI https://gateway.camtech.cam/health</code>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="border-t border-zinc-800/80 py-8 text-center text-xs text-zinc-500 font-mono bg-[#0B0F19]">
    <div class="flex items-center justify-center gap-2 mb-1.5 text-zinc-400">
      <svg class="w-4 h-4 text-[#F38020] fill-current" viewBox="0 0 24 24">
        <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
      </svg>
      <span>Protected by Cloudflare Edge & CamTech Zero-Trust Platform</span>
    </div>
    <p>© 2026 CamTech Corporation. All rights reserved. • High-Availability Distributed Mesh</p>
  </footer>

</body>
</html>
"""
