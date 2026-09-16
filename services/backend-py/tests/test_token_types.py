"""Regression cover for JWT token "type" handling.

Background: `create_access_token` used to do `to_encode.update({"type": "access"})`,
which silently overwrote the type its caller had asked for. The delivery courier
mini-app mints tokens with `type: "delivery"` so that `get_current_user` resolves
the subject against `delivery_drivers` instead of `users`. Because the claim was
clobbered, every authenticated driver request fell into the regular-user branch,
failed to find a `User` row with the driver's id, and returned 401 "User not
found" — drivers could register and then do nothing at all.

`decode_access_token` had the mirror-image problem: it rejected any type that was
not exactly "access", so the delivery branch was unreachable either way.
"""

import datetime

from app.core.security import (
    ACCESS_TOKEN_TYPES,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)


def test_delivery_type_survives_token_creation():
    """The bug in one line: this claim must not be overwritten."""
    token = create_access_token({"sub": "driver-1", "type": "delivery"})
    payload = decode_access_token(token)

    assert payload is not None, "a delivery token must decode as an access token"
    assert payload["type"] == "delivery"
    assert payload["sub"] == "driver-1"


def test_delivery_token_is_accepted_by_the_access_decoder():
    """get_current_user routes on this; if the decoder rejects it, drivers 401."""
    token = create_access_token(
        {"sub": "driver-1", "orgId": "org-1", "type": "delivery", "roles": ["DELIVERY_DRIVER"]}
    )
    payload = decode_access_token(token)

    assert payload is not None
    assert payload["roles"] == ["DELIVERY_DRIVER"]
    assert payload["orgId"] == "org-1"


def test_ordinary_tokens_still_default_to_access():
    token = create_access_token({"sub": "user-1", "orgId": "org-1"})
    payload = decode_access_token(token)

    assert payload is not None
    assert payload["type"] == "access"


def test_refresh_token_is_not_usable_as_an_access_token():
    """The reason the type check exists in the first place — keep it working."""
    refresh = create_refresh_token({"sub": "user-1"})

    assert decode_access_token(refresh) is None
    assert decode_refresh_token(refresh) is not None


def test_unrecognised_type_falls_back_to_access():
    """A caller cannot smuggle in an arbitrary subject type."""
    token = create_access_token({"sub": "user-1", "type": "totally-made-up"})
    payload = decode_access_token(token)

    assert payload is not None
    assert payload["type"] == "access"


def test_access_token_types_excludes_refresh():
    assert "refresh" not in ACCESS_TOKEN_TYPES
    assert {"access", "delivery"} <= set(ACCESS_TOKEN_TYPES)


def test_expired_token_is_rejected():
    token = create_access_token(
        {"sub": "driver-1", "type": "delivery"},
        expires_delta=datetime.timedelta(seconds=-10),
    )
    assert decode_access_token(token) is None
