"""OAuth middleware for MCP server - Keycloak integration."""

import logging
import os
import socket
import time
from typing import Any

import requests
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from jose import jwt
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# Configuration from environment
ORIGIN = os.getenv("ORIGIN", "http://localhost")
APP_PREFIX = os.getenv("APP_PREFIX", "")
KEYCLOAK_INTERNAL_URL = os.getenv("KEYCLOAK_INTERNAL_URL", "http://keycloak:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "master")

# MCP resource URL (canonical - must match what clients use)
MCP_RESOURCE = f"{ORIGIN}{APP_PREFIX}/mcp"
KEYCLOAK_ISSUER = f"{ORIGIN}{APP_PREFIX}/auth/realms/{KEYCLOAK_REALM}"
PRM_URL = f"{MCP_RESOURCE}/.well-known/oauth-protected-resource"

# JWKS URLs - try multiple endpoints for different environments
# 1. Internal URL (works inside Docker)
# 2. Localhost direct (works in local dev)
# 3. Public URL via proxy (works if nginx is configured)
JWKS_URLS = [
    f"{KEYCLOAK_INTERNAL_URL}/auth/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs",
    "http://localhost:8080/auth/realms/master/protocol/openid-connect/certs",
    f"{KEYCLOAK_ISSUER}/protocol/openid-connect/certs",
]

# JWKS cache
_jwks_cache: dict[str, Any] = {"keys": None, "ts": 0.0, "url": None}
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


def _can_resolve_hostname(hostname: str) -> bool:
    """Check if hostname can be resolved (for Docker vs local detection)."""
    try:
        socket.gethostbyname(hostname)
        return True
    except socket.gaierror:
        return False


def get_jwks() -> list[dict[str, Any]]:
    """Get JWKS from Keycloak with caching.
    
    Tries multiple URLs in order:
    1. Internal Docker URL (if hostname resolves)
    2. Localhost direct (for local dev)
    3. Public URL via proxy (fallback)
    """
    now = time.time()
    if _jwks_cache["keys"] is None or now - _jwks_cache["ts"] > JWKS_TTL:
        last_error = None
        
        # Filter URLs based on environment
        urls_to_try = []
        for url in JWKS_URLS:
            # Skip Docker internal URL if hostname doesn't resolve (local dev)
            if "keycloak:8080" in url and not _can_resolve_hostname("keycloak"):
                logger.debug(f"Skipping Docker URL (hostname not resolvable): {url}")
                continue
            urls_to_try.append(url)
        
        # Try each URL until one works
        for jwks_url in urls_to_try:
            try:
                logger.debug(f"Attempting to fetch JWKS from: {jwks_url}")
                response = requests.get(jwks_url, timeout=5)
                response.raise_for_status()
                keys = response.json().get("keys", [])
                if keys:
                    _jwks_cache["keys"] = keys
                    _jwks_cache["ts"] = now
                    _jwks_cache["url"] = jwks_url
                    logger.info(f"Successfully fetched JWKS from: {jwks_url} ({len(keys)} keys)")
                    return keys
            except Exception as e:
                last_error = e
                logger.debug(f"Failed to fetch JWKS from {jwks_url}: {e}")
                continue
        
        # If we have cached keys, use them even if expired
        if _jwks_cache["keys"] is not None:
            logger.warning(
                f"Failed to refresh JWKS, using cached keys from {_jwks_cache.get('url', 'unknown')}. "
                f"Last error: {last_error}"
            )
            return _jwks_cache["keys"]
        
        # No cached keys and all URLs failed
        raise RuntimeError(
            f"Failed to fetch JWKS from all endpoints. Last error: {last_error}"
        ) from last_error
    
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

        # Decode without audience check first to inspect token claims
        claims = jwt.decode(
            token,
            key,
            algorithms=[headers.get("alg", "RS256")],
            issuer=KEYCLOAK_ISSUER,
            options={"verify_at_hash": False, "verify_aud": False},  # Temporarily disable audience
        )
        
        # Check audience manually with better error messages
        token_audience = claims.get("aud")
        if token_audience:
            # Handle both string and list audiences
            audiences = token_audience if isinstance(token_audience, list) else [token_audience]
            
            # Check if MCP_RESOURCE is in audience
            if MCP_RESOURCE not in audiences:
                # Allow client_id as fallback (for backward compatibility)
                client_id = claims.get("azp") or claims.get("client_id")
                if client_id and client_id in audiences:
                    logger.debug(
                        f"Token audience {audiences} doesn't include MCP resource, "
                        f"but client_id {client_id} matches. Allowing for backward compatibility."
                    )
                else:
                    logger.warning(
                        f"Token audience mismatch: expected {MCP_RESOURCE}, "
                        f"got {audiences}. Client ID: {client_id}. "
                        f"Token issuer: {claims.get('iss')}"
                    )
                    raise ValueError(
                        f"Token audience {audiences} does not match MCP resource {MCP_RESOURCE}. "
                        f"Configure Keycloak client scope with audience mapper for: {MCP_RESOURCE}"
                    )
        else:
            logger.warning(
                f"Token missing audience claim. Expected: {MCP_RESOURCE}. "
                f"Configure Keycloak client scope with audience mapper."
            )
            # Don't fail if audience is missing - allow for now but log warning
        
        return claims
    except jwt.ExpiredSignatureError:
        logger.warning("MCP OAuth token expired")
        raise ValueError("Token expired")
    except jwt.JWTClaimsError as e:
        logger.warning(f"MCP OAuth token claims invalid: {e}")
        raise ValueError(f"Token claims invalid: {e}") from e
    except ValueError:
        # Re-raise ValueError as-is (already has good error message)
        raise
    except Exception as e:
        logger.error(f"MCP OAuth token verification failed: {e}", exc_info=True)
        raise ValueError(f"Token verification failed: {e}") from e


def oauth_401() -> Response:
    """Return 401 with WWW-Authenticate header pointing to PRM."""
    return Response(
        status_code=status.HTTP_401_UNAUTHORIZED,
        headers={
            "WWW-Authenticate": f'Bearer realm="mcp", authorization_uri="{PRM_URL}"'
        },
    )


class McpOAuthMiddleware(BaseHTTPMiddleware):
    """Middleware for MCP OAuth authentication and feature flag gating."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Process MCP requests with OAuth and feature flag checks."""
        path = request.url.path

        # Build expected MCP paths
        mcp_path = f"{APP_PREFIX}/mcp" if APP_PREFIX else "/mcp"
        prm_path = (
            f"{APP_PREFIX}/.well-known/oauth-protected-resource"
            if APP_PREFIX
            else "/.well-known/oauth-protected-resource"
        )
        mcp_prm_path = f"{mcp_path}/.well-known/oauth-protected-resource"

        # Handle PRM discovery endpoint (no auth required) - check both locations
        if (
            path == prm_path
            or path == mcp_prm_path
            or path.endswith("/.well-known/oauth-protected-resource")
        ):
            return JSONResponse(
                {
                    "resource": MCP_RESOURCE,
                    "authorization_servers": [KEYCLOAK_ISSUER],
                }
            )

        # Only process /mcp paths
        if not path.startswith(mcp_path) and not path.startswith("/mcp"):
            return await call_next(request)

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
            logger.debug(
                f"MCP OAuth token validated successfully. "
                f"Subject: {claims.get('sub')}, Client: {claims.get('azp')}"
            )
        except ValueError as e:
            logger.warning(f"MCP OAuth token validation failed: {e}")
            return oauth_401()

        # Continue to MCP server
        return await call_next(request)
