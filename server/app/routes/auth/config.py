"""GET /auth/config — auth discovery endpoint.

Returns the OIDC configuration URLs so any client can discover where to
authenticate. Works with any standard OAuth2/OIDC library (next-auth,
passport, authlib, etc.).

No auth required for this endpoint (chicken-and-egg: client needs this
to know how to authenticate).
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


def _get_auth_config() -> dict[str, Any]:
    """Build auth configuration from environment."""
    origin = os.getenv("ORIGIN", "http://localhost")
    app_prefix = os.getenv("APP_PREFIX", "")
    keycloak_realm = os.getenv("KEYCLOAK_REALM", "master")

    # Keycloak issuer (the authorization server)
    keycloak_issuer = f"{origin}{app_prefix}/auth/realms/{keycloak_realm}"

    # Default IdP (built-in OIDC provider)
    origin_check = os.getenv("ORIGIN", "http://localhost:3000")
    is_local_dev = "localhost" in origin_check.lower()
    server_base = "http://localhost:8000" if is_local_dev else origin
    default_idp_base = f"{server_base}{app_prefix}/default-idp"

    return {
        # The built-in OIDC provider (batteries included)
        "issuer": keycloak_issuer,
        "authorization_endpoint": f"{keycloak_issuer}/protocol/openid-connect/auth",
        "token_endpoint": f"{keycloak_issuer}/protocol/openid-connect/token",
        "jwks_uri": f"{keycloak_issuer}/protocol/openid-connect/certs",
        "userinfo_endpoint": f"{keycloak_issuer}/protocol/openid-connect/userinfo",
        # Standard OIDC discovery URL
        "openid_configuration": f"{keycloak_issuer}/.well-known/openid-configuration",
        # Default IdP endpoints (alternative direct OIDC provider)
        "default_idp": {
            "issuer": default_idp_base,
            "openid_configuration": f"{default_idp_base}/.well-known/openid-configuration",
        },
        # Supported grant types
        "grant_types_supported": ["authorization_code"],
        "code_challenge_methods_supported": ["S256"],
    }


class GetAuthConfigApiResponse(BaseModel):
    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    jwks_uri: str
    userinfo_endpoint: str
    openid_configuration: str
    default_idp: dict[str, str]
    grant_types_supported: list[str]
    code_challenge_methods_supported: list[str]


@router.get(
    "/config",
    response_model=GetAuthConfigApiResponse,
)
async def get_auth_config() -> GetAuthConfigApiResponse:
    """Auth discovery — returns OIDC URLs for client configuration.

    No authentication required. Any client can call this to discover
    where to send users for login.

    Usage:
        GET /auth/config
        → Use the returned URLs with any OAuth2/OIDC library
    """
    config = _get_auth_config()
    return GetAuthConfigApiResponse(**config)
