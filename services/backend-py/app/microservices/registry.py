# ==============================================================================
# Service Registry — the one place that says which service owns which URLs
# ==============================================================================
# Adding a service, or moving a domain between services, is an edit here plus the
# router mount in the service file. tests/test_gateway_routing.py fails if the
# gateway would send any monolith route to a service that does not serve it.
# ==============================================================================

from __future__ import annotations

import os
from dataclasses import dataclass

API_PREFIX = "/api/v1"


@dataclass(frozen=True)
class Service:
    key: str
    module: str
    port: int
    url_env: str
    prefixes: tuple[str, ...] = ()

    @property
    def url(self) -> str:
        return os.getenv(self.url_env, f"http://127.0.0.1:{self.port}")


AUTH = Service(
    "auth", "app.microservices.auth_service", 4001, "AUTH_SERVICE_URL",
    ("auth", "organizations", "locations"),
)
CATALOG = Service(
    "catalog", "app.microservices.catalog_service", 4002, "CATALOG_SERVICE_URL",
    (
        "products", "public", "categories", "brands", "inventory", "warehouse",
        "pricing", "taxes", "promotions", "wms", "loyalty",
    ),
)
SALES = Service("sales", "app.microservices.sales_service", 4003, "SALES_SERVICE_URL", ("sales", "customers"))
DELIVERY = Service("delivery", "app.microservices.delivery_service", 4004, "DELIVERY_SERVICE_URL", ("delivery",))
HR = Service("hr", "app.microservices.hr_service", 4005, "HR_SERVICE_URL", ("hr",))
FINANCE = Service(
    "finance", "app.microservices.finance_service", 4006, "FINANCE_SERVICE_URL",
    ("finance", "accounts", "assets"),
)
# Platform & Experience owns every domain not carved into a core service, so it
# has no prefix list: resolve_service falls through to it.
PLATFORM = Service("platform", "app.microservices.platform_service", 4007, "PLATFORM_SERVICE_URL")
BOT_BUILDER = Service(
    "botBuilder", "app.microservices.bot_builder_service", 4008, "BOT_BUILDER_SERVICE_URL", ("bot-builder",),
)
INFRA = Service(
    "infra", "app.microservices.infra_service", 4009, "INFRA_SERVICE_URL", ("infra", "observability"),
)

SERVICES: tuple[Service, ...] = (AUTH, CATALOG, SALES, DELIVERY, HR, FINANCE, PLATFORM, BOT_BUILDER, INFRA)

_OWNER_BY_SEGMENT = {prefix: service for service in SERVICES for prefix in service.prefixes}


def resolve_service(path: str) -> Service:
    """The service owning an /api/v1 path, matched on a whole path segment so that
    /api/v1/authorize never lands on the service owning /api/v1/auth."""
    segment = path.removeprefix(f"{API_PREFIX}/").split("/", 1)[0]
    return _OWNER_BY_SEGMENT.get(segment, PLATFORM)
