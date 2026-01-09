"""OAuth middleware for MCP server - Keycloak integration."""

import os
import time
from typing import Any

import requests
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from jose import jwt
from starlette.middleware.base import BaseHTTPMiddleware

# Configuration from environment
ORIGIN = os.getenv("ORIGIN", "http://localhost")
APP_PREFIX = os.getenv("APP_PREFIX", "")
KEYCLOAK_INTERNAL_URL = os.getenv("KEYCLOAK_INTERNAL_URL", "http://keycloak:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "master")

# MCP resource URL (canonical - must match what clients use)
MCP_RESOURCE = f"{ORIGIN}{APP_PREFIX}/mcp"
KEYCLOAK_ISSUER = f"{ORIGIN}{APP_PREFIX}/auth/realms/{KEYCLOAK_REALM}"
JWKS_URL = f"{KEYCLOAK_ISSUER}/protocol/openid-connect/certs"
PRM_URL = f"{MCP_RESOURCE}/.well-known/oauth-protected-resource"

# JWKS cache
_jwks_cache: dict[str, Any] = {"keys": None, "ts": 0.0}
JWKS_TTL = 60  # seconds


def is_mcp_enabled() -> bool:
    """Check if MCP is enabled (hardcoded for now, ready for DB integration).
    
    TODO: Replace with DB check:
        async with get_db() as conn:
            result = await conn.fetchval(
                "SELECT value FROM settings WHERE key = 'mcp_enabled' LIMIT 1"
            )
            return result is True
    """
    # Hardcoded for now - return False to disable, True to enable
    return True


def get_jwks() -> list[dict[str, Any]]:
    """Get JWKS from Keycloak with caching."""
    now = time.time()
    if _jwks_cache["keys"] is None or now - _jwks_cache["ts"] > JWKS_TTL:
        try:
            response = requests.get(JWKS_URL, timeout=5)
            response.raise_for_status()
            _jwks_cache["keys"] = response.json()["keys"]
            _jwks_cache["ts"] = now
        except Exception as e:
            # Log error but don't fail - use cached keys if available
            if _jwks_cache["keys"] is None:
                raise RuntimeError(f"Failed to fetch JWKS: {e}") from e
    return _jwks_cache["keys"]


def bearer_from_request(request: Request) -> str | None:
    """Extract Bearer token from Authorization header."""
    auth = request.headers.get("authorization")
    if not auth:
        return None
    parts = auth.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def verify_token(token: str) -> dict[str, Any]:
    """Verify JWT token from Keycloak.
    
    Args:
        token: JWT token string
        
    Returns:
        Decoded token claims
        
    Raises:
        ValueError: If token is invalid
    """
    try:
        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")
        if not kid:
            raise ValueError("Token missing kid header")
            
        keys = get_jwks()
        key = next((k for k in keys if k.get("kid") == kid), None)
        if not key:
            raise ValueError("No matching JWK found")
            
        claims = jwt.decode(
            token,
            key,
            algorithms=[headers.get("alg", "RS256")],
            audience=MCP_RESOURCE,
            issuer=KEYCLOAK_ISSUER,
            options={"verify_at_hash": False},
        )
        return claims
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expired")
    except jwt.JWTClaimsError as e:
        raise ValueError(f"Token claims invalid: {e}") from e
    except Exception as e:
        raise ValueError(f"Token verification failed: {e}") from e


def oauth_401() -> Response:
    """Return 401 with WWW-Authenticate header pointing to PRM."""
    return Response(
        status_code=status.HTTP_401_UNAUTHORIZED,
        headers={"WWW-Authenticate": f'Bearer realm="mcp", authorization_uri="{PRM_URL}"'},
    )


class McpOAuthMiddleware(BaseHTTPMiddleware):
    """Middleware for MCP OAuth authentication and feature flag gating."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Process MCP requests with OAuth and feature flag checks."""
        path = request.url.path
        
        # Build expected MCP paths
        mcp_path = f"{APP_PREFIX}/mcp" if APP_PREFIX else "/mcp"
        prm_path = f"{APP_PREFIX}/.well-known/oauth-protected-resource" if APP_PREFIX else "/.well-known/oauth-protected-resource"
        
        # Only process /mcp paths
        if not path.startswith(mcp_path) and not path.startswith("/mcp"):
            return await call_next(request)
            
        # Handle PRM discovery endpoint (no auth required)
        if path.endswith("/.well-known/oauth-protected-resource") or path == prm_path:
            return JSONResponse(
                {
                    "resource": MCP_RESOURCE,
                    "authorization_servers": [KEYCLOAK_ISSUER],
                }
            )
        
        # Check feature flag first
        if not is_mcp_enabled():
            return JSONResponse(
                {
                    "error": "mcp_disabled",
                    "message": "MCP is currently disabled.",
                },
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                headers={"Retry-After": "300"},
            )
        
        # Check for Bearer token
        token = bearer_from_request(request)
        if not token:
            return oauth_401()
        
        # Verify token
        try:
            claims = verify_token(token)
            # Attach claims to request state for downstream use
            request.state.mcp_claims = claims
        except ValueError:
            return oauth_401()
        
        # Continue to MCP server
        return await call_next(request)
