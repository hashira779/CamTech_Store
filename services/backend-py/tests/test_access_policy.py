from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.access_policy import ACCESS_RULES, enforce_access, is_allowed


def _allowed(method, area, *roles, permissions=()):
    return is_allowed(method, f"/api/v1/{area}", roles, permissions)


@pytest.mark.parametrize(
    "method, area",
    [
        ("POST", "finance/journal-entries"),
        ("GET", "finance/accounts"),
        ("POST", "hr/employees"),
        ("GET", "hr/employees"),
        ("POST", "hr/leaves/abc/approve"),
        ("POST", "products"),
        ("DELETE", "products/abc"),
        ("POST", "inventory/adjust"),
        ("POST", "exchange/import/products"),
        ("POST", "outbox/consume"),
        ("POST", "events/broadcast"),
        ("POST", "storage/providers"),
    ],
)
def test_cashier_is_refused_outside_their_job(method, area):
    assert not _allowed(method, area, "CASHIER", "STAFF")


@pytest.mark.parametrize(
    "method, area",
    [
        ("POST", "sales"),
        ("GET", "products"),
        ("GET", "inventory/items"),
        ("POST", "customers"),
        ("POST", "hr/leaves"),
        ("POST", "storage/upload-intent"),
        ("POST", "ai/chat"),
    ],
)
def test_cashier_keeps_what_the_pos_needs(method, area):
    assert _allowed(method, area, "CASHIER")


def test_each_role_reaches_its_own_area():
    assert _allowed("POST", "finance/journal-entries", "ACCOUNTANT")
    assert _allowed("POST", "hr/employees", "HR_MANAGER")
    assert _allowed("POST", "inventory/adjust", "STOCK_CLERK")
    assert _allowed("POST", "products", "MANAGER")
    assert _allowed("POST", "finance/accounts", "ORG_ADMIN")


def test_managers_can_read_but_not_write_the_ledger():
    assert _allowed("GET", "finance/accounts", "MANAGER")
    assert not _allowed("POST", "finance/journal-entries", "MANAGER")


def test_custom_role_passes_with_a_granted_permission():
    assert _allowed("POST", "products", "MERCHANDISER", permissions=["catalog:write"])
    assert _allowed("POST", "products", "CUSTOM", permissions=["*"])
    assert not _allowed("POST", "products", "MERCHANDISER", permissions=["catalog:read"])


def test_rule_prefix_does_not_swallow_sibling_paths():
    assert _allowed("POST", "appsumo", "CASHIER")
    assert _allowed("POST", "hrx", "CASHIER")


def _request(method, path):
    return SimpleNamespace(method=method, url=SimpleNamespace(path=path))


CASHIER = SimpleNamespace(id="u1", roles=["CASHIER"], permissions=[])


def test_denial_is_a_structured_403(monkeypatch):
    monkeypatch.delenv("ACCESS_POLICY_MODE", raising=False)
    with pytest.raises(HTTPException) as denied:
        enforce_access(_request("POST", "/api/v1/hr/employees"), CASHIER)
    assert denied.value.status_code == 403
    assert denied.value.detail["roles"] == ["CASHIER"]


def test_report_mode_logs_without_refusing(monkeypatch):
    monkeypatch.setenv("ACCESS_POLICY_MODE", "report")
    enforce_access(_request("POST", "/api/v1/hr/employees"), CASHIER)


def test_every_rule_matches_a_mounted_route():
    from app.main import app

    areas = [
        route.path.removeprefix("/api/v1/")
        for route in app.routes
        if hasattr(route, "methods") and route.path.startswith("/api/v1/")
    ]
    orphaned = [
        rule.prefix
        for rule in ACCESS_RULES
        if not any(area == rule.prefix or area.startswith(f"{rule.prefix}/") for area in areas)
    ]
    assert orphaned == []
