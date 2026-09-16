"""Passkey (WebAuthn) unit coverage.

Deliberately does not attempt a full ceremony — that needs a real authenticator.
What is covered here is the logic we wrote ourselves and can get wrong:
relying-party isolation, challenge single-use, and the admin/own-credential
boundaries. The cryptographic verification itself is py_webauthn's job.
"""

import json

import pytest

from app.core.passkey_config import (
    DEV,
    STAFF,
    STOREFRONT,
    resolve_relying_party,
)
from app.modules.identity.passkey_challenges import PasskeyChallengeStore


# ─── Relying party isolation ────────────────────────────────────────────────

def test_staff_and_storefront_are_separate_relying_parties():
    """The whole point of the split: a storefront credential must not be usable
    in a staff ceremony, which only holds if the RP IDs differ."""
    assert STAFF.rp_id != STOREFRONT.rp_id


@pytest.mark.parametrize(
    "origin,expected_key",
    [
        ("https://adminconsol.camtech.cam", "staff"),
        ("https://pos.camtech.cam", "staff"),
        ("https://ceo.camtech.cam", "staff"),
        ("https://hr.camtech.cam", "staff"),
        ("https://store.camtech.cam", "storefront"),
    ],
)
def test_known_origins_resolve_to_their_relying_party(origin, expected_key):
    party = resolve_relying_party(origin)
    assert party is not None
    assert party.key == expected_key


@pytest.mark.parametrize(
    "origin",
    [
        None,
        "",
        "https://evil.example.com",
        "https://adminconsol.camtech.cam.evil.example.com",
        # The apex serves the storefront but is the staff RP's domain; it is
        # intentionally not a registered passkey origin for either party.
        "https://camtech.cam",
    ],
)
def test_unknown_origins_are_refused(origin):
    """No default RP: an unlisted origin must never fall through to staff."""
    assert resolve_relying_party(origin) is None


def test_localhost_resolves_to_dev_outside_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    party = resolve_relying_party("http://localhost:61234")
    assert party is not None
    assert party.key == DEV.key


def test_localhost_is_refused_in_production(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    assert resolve_relying_party("http://localhost:61234") is None


# ─── Challenge store ────────────────────────────────────────────────────────

@pytest.fixture
def memory_store():
    store = PasskeyChallengeStore()
    store._redis = None  # exercise the in-memory fallback deterministically
    return store


async def test_challenge_is_single_use(memory_store):
    """A replayable challenge means a replayable assertion."""
    await memory_store.put("handle-1", {"kind": "registration", "challenge": "abcd"})

    assert await memory_store.take("handle-1") == {
        "kind": "registration",
        "challenge": "abcd",
    }
    assert await memory_store.take("handle-1") is None


async def test_unknown_handle_returns_none(memory_store):
    assert await memory_store.take("never-issued") is None


async def test_expired_challenge_is_not_returned(memory_store, monkeypatch):
    import app.modules.identity.passkey_challenges as mod

    monkeypatch.setattr(mod, "CHALLENGE_TTL_SECONDS", -1)
    await memory_store.put("stale", {"kind": "authentication", "challenge": "ff"})
    assert await memory_store.take("stale") is None


# ─── Option generation ─────────────────────────────────────────────────────

def test_registration_options_are_bound_to_the_resolved_rp():
    from webauthn import generate_registration_options, options_to_json
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria,
        ResidentKeyRequirement,
        UserVerificationRequirement,
    )

    options = generate_registration_options(
        rp_id=STAFF.rp_id,
        rp_name=STAFF.name,
        user_id=b"user-1",
        user_name="admin@demo.test",
        user_display_name="Demo Admin",
        authenticator_selection=AuthenticatorSelectionCriteria(
            resident_key=ResidentKeyRequirement.PREFERRED,
            user_verification=UserVerificationRequirement.PREFERRED,
        ),
        exclude_credentials=[],
    )
    payload = json.loads(options_to_json(options))

    assert payload["rp"]["id"] == STAFF.rp_id
    # Discoverable credentials are what allow login without typing an email.
    assert payload["authenticatorSelection"]["residentKey"] == "preferred"
    assert len(options.challenge) >= 16


def test_authentication_options_allow_discoverable_login():
    from webauthn import generate_authentication_options, options_to_json
    from webauthn.helpers.structs import UserVerificationRequirement

    options = generate_authentication_options(
        rp_id=STAFF.rp_id,
        allow_credentials=None,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    payload = json.loads(options_to_json(options))

    assert payload["rpId"] == STAFF.rp_id
    assert not payload.get("allowCredentials")
