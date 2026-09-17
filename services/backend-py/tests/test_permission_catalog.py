"""Guards the permission catalogue against drift.

The Create Custom Role dialog used to render a hardcoded array in the frontend.
It fell out of date silently: five permissions that guarded real endpoints were
absent, so no custom role could be granted Control Center access, while eight
checkboxes gated nothing at all.

The test that matters here is `test_every_enforced_permission_is_grantable` —
it fails the build when someone adds a guarded endpoint whose permission is not
in the catalogue, which is the exact way the old list rotted.
"""

from __future__ import annotations

import pathlib
import re

from app.core.permission_catalog import (
    CATALOG,
    WILDCARD,
    as_payload,
    catalog_keys,
    enforced_keys,
)

BACKEND_APP = pathlib.Path(__file__).resolve().parents[1] / "app"

GUARD_CALL = re.compile(r"Require(?:Any)?Permissions?\(\s*\[([^\]]*)\]")
QUOTED = re.compile(r'"([^"]+)"')


def permissions_enforced_in_code() -> set[str]:
    """Every permission string passed to a RequirePermissions guard."""
    found: set[str] = set()
    for path in BACKEND_APP.rglob("*.py"):
        source = path.read_text(encoding="utf-8", errors="ignore")
        for match in GUARD_CALL.finditer(source):
            found |= set(QUOTED.findall(match.group(1)))
    return found


def test_every_enforced_permission_is_grantable():
    """A guarded endpoint whose permission is missing from the catalogue can
    never be granted to a custom role — the failure mode that made Control
    Center access impossible to assign."""
    missing = permissions_enforced_in_code() - set(catalog_keys())
    assert not missing, (
        "These permissions guard endpoints but are absent from the catalogue, "
        f"so no custom role can be granted them: {sorted(missing)}"
    )


def test_enforced_flag_matches_reality():
    """`enforced` must describe the code, not intent.

    A permission advertised as active while gating nothing is worse than a
    missing one: an administrator grants it and believes access is restricted.
    """
    in_code = permissions_enforced_in_code()
    wrong = [
        p.key for p in CATALOG
        if p.enforced != (p.key in in_code)
    ]
    assert not wrong, (
        "Catalogue `enforced` flags disagree with the code for: "
        f"{sorted(wrong)}. Either guard them or mark enforced=False."
    )


def test_catalogue_has_no_duplicate_keys():
    keys = catalog_keys()
    assert len(keys) == len(set(keys))


def test_wildcard_is_not_a_grantable_entry():
    """`*` is how SUPER_ADMIN/ORG_ADMIN short-circuit. It must not appear as a
    checkbox a custom role can tick, or any role could self-elevate to full
    platform access."""
    assert WILDCARD not in catalog_keys()


def test_control_center_permissions_are_marked_platform_scope():
    """Cross-tenant operational data must be flagged so it is not handed to a
    tenant role by accident (§28)."""
    platform = {p.key for p in CATALOG if p.platform_scope}
    assert {
        "infra.services.read",
        "infra.metrics.read",
        "infra.logs.read",
        "infra.traces.read",
        "security.events.read",
    } <= platform


def test_payload_shape_is_stable_for_the_role_editor():
    payload = as_payload()
    assert payload["wildcard"] == WILDCARD
    assert payload["categories"], "catalogue must not be empty"

    seen = set()
    for category in payload["categories"]:
        assert category["name"]
        assert category["permissions"]
        for perm in category["permissions"]:
            assert set(perm) == {"key", "label", "description", "enforced", "platformScope"}
            assert perm["label"] and perm["description"]
            seen.add(perm["key"])

    # Every catalogue entry must reach the UI, or it is ungrantable again.
    assert seen == set(catalog_keys())


def test_catalogue_is_larger_than_the_list_it_replaced():
    """The hardcoded frontend array had 18 entries and omitted the 5 Control
    Center permissions. Regression canary."""
    assert len(catalog_keys()) >= 23
    assert len(enforced_keys()) == len(permissions_enforced_in_code())
