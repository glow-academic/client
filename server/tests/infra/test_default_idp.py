from __future__ import annotations

from jose import jwt

from app.infra.identity.default_idp import exchange_code_for_tokens


def test_exchange_code_for_tokens_puts_profile_identity_on_access_token():
    code = "code-access-token-contract"

    from app.infra.identity import default_idp

    default_idp._authorization_codes[code] = {
        "profile_id": "019ce726-fa14-7f2a-aebb-0067bca4b029",
        "email": "alice@example.com",
        "name": "Alice Example",
        "role": "admin",
        "nonce": "nonce-123",
        "expires_at": 4102444800,
        "client_id": "test-client",
        "redirect_uri": "http://localhost/callback",
        "is_emulation": True,
        "actor_profile_id": "019ce726-fa14-7f2a-aebb-0067bca4b030",
    }

    tokens = exchange_code_for_tokens(
        grant_type="authorization_code",
        code=code,
        redirect_uri="http://localhost/callback",
        client_id="test-client",
    )

    access_claims = jwt.get_unverified_claims(tokens["access_token"])
    id_claims = jwt.get_unverified_claims(tokens["id_token"])

    assert access_claims["profile_id"] == "019ce726-fa14-7f2a-aebb-0067bca4b029"
    assert access_claims["role"] == "admin"
    assert access_claims["is_emulation"] is True
    assert (
        access_claims["actor_profile_id"] == "019ce726-fa14-7f2a-aebb-0067bca4b030"
    )

    assert access_claims["profile_id"] == id_claims["profile_id"]
    assert access_claims["role"] == id_claims["role"]
    assert access_claims["is_emulation"] == id_claims["is_emulation"]
    assert access_claims["actor_profile_id"] == id_claims["actor_profile_id"]
