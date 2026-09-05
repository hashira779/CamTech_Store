# ==============================================================================
# CamTech Universal Enterprise API Gateway Dashboard
# High-Aesthetics, Responsive Edge Command Center (2026-2030 Standard)
# ==============================================================================

def get_gateway_dashboard_html() -> str:
    return """<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CamTech Universal API Gateway — Enterprise Microservices</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'sans-serif'],
            mono: ['"JetBrains Mono"', 'monospace'],
          },
          colors: {
            brand: {
              50: '#eef2ff',
              100: '#e0e7ff',
              500: '#6366f1',
              600: '#4f46e5',
              700: '#4338ca',
            }
          }
        }
      }
    }
  </script>
  <style>
    @keyframes pulseGlow {
      0%, 100% { opacity: 0.15; transform: scale(1); }
      50% { opacity: 0.25; transform: scale(1.05); }
    }
    .ambient-glow {
      animation: pulseGlow 8s ease-in-out infinite;
    }
  </style>
</head>
<body class="min-h-screen bg-[#09090b] text-zinc-100 font-sans antialiased relative overflow-x-hidden selection:bg-indigo-500 selection:text-white">

  <!-- Ambient Glow Effects -->
  <div class="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-r from-blue-600/20 via-indigo-600/25 to-purple-600/20 blur-[140px] rounded-full ambient-glow"></div>
  <div class="pointer-events-none absolute top-[600px] -right-40 w-[600px] h-[400px] bg-gradient-to-tr from-purple-600/15 via-indigo-500/15 to-cyan-500/10 blur-[130px] rounded-full"></div>

  <!-- Top Navigation Bar -->
  <header class="sticky top-0 z-50 backdrop-blur-xl bg-zinc-950/70 border-b border-zinc-800/80">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(99,102,241,0.5)] font-black text-sm">
          CT
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-base tracking-tight text-white">CamTech API Gateway</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">v2.0</span>
          </div>
          <p class="text-[11px] text-zinc-400 font-mono hidden sm:block">Universal Microservices Reverse Proxy (:4000)</p>
        </div>
      </div>

      <!-- Quick Action Navigation -->
      <div class="flex items-center gap-2 sm:gap-3">
        <a href="/docs" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-[0_0_15px_rgba(99,102,241,0.4)]">
          <span>⚡ Swagger UI</span>
        </a>
        <a href="/redoc" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700/80 transition">
          <span>📋 ReDoc</span>
        </a>
        <a href="/health" target="_blank" class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-medium border border-emerald-500/30">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Health JSON</span>
        </a>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-20 relative z-10">
    <div class="text-center max-w-3xl mx-auto space-y-4">
      <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs font-mono text-zinc-400">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>Gateway Operational • 7 Microservices Healthy</span>
      </div>

      <h1 class="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
        Enterprise Microservices <br class="hidden sm:inline"/>
        <span class="bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">API Command Center</span>
      </h1>

      <p class="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl mx-auto font-normal">
        Unified, zero-downtime gateway routing inbound requests across isolated domain microservices with local in-process fallback and PostgreSQL 16 persistence.
      </p>

      <!-- Primary Action Buttons -->
      <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
        <a href="/docs" class="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-[0_0_25px_rgba(99,102,241,0.5)] transition flex items-center gap-2">
          <span>Explore 116 Endpoints in Swagger UI</span>
          <span>→</span>
        </a>
        <a href="/openapi.json" target="_blank" class="px-5 py-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 font-semibold text-sm border border-zinc-800 transition flex items-center gap-2">
          <span>OpenAPI 3.1 Spec</span>
        </a>
        <a href="https://adminconsol.camtech.cam" target="_blank" class="px-5 py-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 font-semibold text-sm border border-zinc-800 transition flex items-center gap-2">
          <span>Admin Portal</span>
        </a>
      </div>
    </div>

    <!-- Infrastructure Key Metrics -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 mb-12">
      <div class="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 backdrop-blur-md">
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Topology</div>
        <div class="text-2xl font-extrabold text-white mt-1">7 Services</div>
        <div class="text-xs text-emerald-400 font-mono mt-0.5">● Fully Isolated Ports</div>
      </div>
      <div class="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 backdrop-blur-md">
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">API Surface</div>
        <div class="text-2xl font-extrabold text-white mt-1">116 Routes</div>
        <div class="text-xs text-indigo-400 font-mono mt-0.5">REST + SSE + Websocket</div>
      </div>
      <div class="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 backdrop-blur-md">
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Resilience</div>
        <div class="text-2xl font-extrabold text-white mt-1">Zero Downtime</div>
        <div class="text-xs text-amber-300 font-mono mt-0.5">Auto In-Process Fallback</div>
      </div>
      <div class="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 backdrop-blur-md">
        <div class="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Database</div>
        <div class="text-2xl font-extrabold text-white mt-1">PostgreSQL 16</div>
        <div class="text-xs text-cyan-400 font-mono mt-0.5">AsyncPG + Redis Outbox</div>
      </div>
    </div>

    <!-- Microservices Topology Grid -->
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-bold text-white tracking-tight">Active Microservices Cluster</h2>
          <p class="text-xs text-zinc-400">Real-time routing map configured in Edge Gateway</p>
        </div>
        <div class="text-xs font-mono text-zinc-500">Gateway Port: 4000</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Service 1 -->
        <div class="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-indigo-500/50 transition flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Port 4001
              </span>
              <span class="text-[11px] font-mono text-zinc-500">mystore-auth-service</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Auth & Identity Service</h3>
            <p class="text-xs text-zinc-400 mt-1">Multi-tenant provisioning, JWT issuance, Bcrypt security, role-based access control.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/auth</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/organizations</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/locations</code>
          </div>
        </div>

        <!-- Service 2 -->
        <div class="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-indigo-500/50 transition flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Port 4002
              </span>
              <span class="text-[11px] font-mono text-zinc-500">mystore-catalog-service</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Catalog & Products Service</h3>
            <p class="text-xs text-zinc-400 mt-1">Product matrix, SKU variants, category hierarchy, dynamic pricing & barcode scanning.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/products</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/categories</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/inventory</code>
          </div>
        </div>

        <!-- Service 3 -->
        <div class="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-indigo-500/50 transition flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Port 4003
              </span>
              <span class="text-[11px] font-mono text-zinc-500">mystore-sales-service</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Sales & Commerce Service</h3>
            <p class="text-xs text-zinc-400 mt-1">POS register settlement, Storefront checkout, Bakong KHQR, customer loyalty points.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/sales</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/customers</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/loyalty</code>
          </div>
        </div>

        <!-- Service 4 -->
        <div class="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-indigo-500/50 transition flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Port 4004
              </span>
              <span class="text-[11px] font-mono text-zinc-500">mystore-delivery-service</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Delivery & Logistics Service</h3>
            <p class="text-xs text-zinc-400 mt-1">Live courier telemetry, mobile order dispatch, proof of delivery (POD), COD balancing.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/delivery</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/delivery/orders</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/delivery/drivers</code>
          </div>
        </div>

        <!-- Service 5 -->
        <div class="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-indigo-500/50 transition flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Port 4005
              </span>
              <span class="text-[11px] font-mono text-zinc-500">mystore-hr-service</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">HR & Workforce Service</h3>
            <p class="text-xs text-zinc-400 mt-1">Department tree structures, employee directory, leave management, automated payroll runs.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/hr/employees</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/hr/departments</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/hr/payroll</code>
          </div>
        </div>

        <!-- Service 6 -->
        <div class="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-indigo-500/50 transition flex flex-col justify-between gap-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Port 4006
              </span>
              <span class="text-[11px] font-mono text-zinc-500">mystore-finance-service</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Finance & General Ledger</h3>
            <p class="text-xs text-zinc-400 mt-1">Double-entry accounting, chart of accounts, trial balance, tax withholding calculations.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/finance/accounts</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/finance/journal-entries</code>
          </div>
        </div>

        <!-- Service 7 -->
        <div class="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-indigo-500/50 transition flex flex-col justify-between gap-3 md:col-span-2 lg:col-span-3">
          <div>
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Port 4007
              </span>
              <span class="text-[11px] font-mono text-zinc-500">mystore-platform-service</span>
            </div>
            <h3 class="text-base font-bold text-white mt-2">Platform, Copilot & Event Outbox</h3>
            <p class="text-xs text-zinc-400 mt-1">AI Assistant Copilot, Redis asynchronous event streaming, reliable outbox transactional delivery, and industry configuration engine.</p>
          </div>
          <div class="pt-2 border-t border-zinc-800/80 flex flex-wrap gap-1.5">
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/copilot</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/events</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/outbox</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/notifications</code>
            <code class="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-indigo-300">/api/v1/wms</code>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Terminal Probe -->
    <div class="mt-12 p-6 rounded-2xl bg-zinc-950/90 border border-zinc-800 font-mono text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-zinc-800 text-zinc-400">
        <span>⚡ Quick Terminal Test (Admin Authentication)</span>
        <span class="text-indigo-400">HTTP/2 & HTTP/3</span>
      </div>
      <div class="mt-3 p-3 rounded-xl bg-zinc-900/90 text-zinc-300 overflow-x-auto select-all">
        <code>curl -X POST https://gateway.camtech.cam/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.test","password":"Admin123!"}'</code>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="border-t border-zinc-800/80 py-8 text-center text-xs text-zinc-500 font-mono">
    <p>CamTech Store Enterprise Platform • 2026–2030 Cloud-Native Architecture</p>
    <p class="mt-1">FastAPI Monolith + 7 Port Microservices • PostgreSQL 16 Native ENUMs • Redis 7 Outbox</p>
  </footer>

</body>
</html>
"""
