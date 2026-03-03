"""OAuth middleware for MCP server - Keycloak integration."""

import json
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

# Detect local dev environment (same pattern as keycloak_sync.py)
origin_check = os.getenv("ORIGIN", "http://localhost:3000")
is_local_dev = "localhost" in origin_check.lower()

# MCP resource URL - use server port (8000) in dev, ORIGIN in prod
if is_local_dev:
    MCP_SERVER_BASE = "http://localhost:8000"
else:
    MCP_SERVER_BASE = ORIGIN

MCP_RESOURCE = f"{MCP_SERVER_BASE}{APP_PREFIX}/mcp"
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
                    logger.info(
                        f"Successfully fetched JWKS from: {jwks_url} ({len(keys)} keys)"
                    )
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

        # Decode without audience/issuer check first to inspect token claims
        # We'll validate issuer manually to handle both direct Keycloak URL and proxied URL
        claims = jwt.decode(
            token,
            key,
            algorithms=[headers.get("alg", "RS256")],
            options={
                "verify_at_hash": False,
                "verify_aud": False,
                "verify_iss": False,
            },  # Disable issuer check temporarily
        )

        # Validate issuer manually - accept both direct Keycloak URL and proxied URL
        token_issuer = claims.get("iss", "")
        expected_issuers = [
            KEYCLOAK_ISSUER,  # Expected issuer (via proxy)
            f"{KEYCLOAK_INTERNAL_URL}/auth/realms/{KEYCLOAK_REALM}",  # Direct Keycloak URL
            "http://localhost:8080/auth/realms/master",  # Fallback for local dev
        ]

        if token_issuer and token_issuer not in expected_issuers:
            # Check if it's just a port difference (localhost:8080 vs localhost:3000)
            token_issuer_base = token_issuer.replace(":8080", "").replace(":3000", "")
            expected_issuer_base = KEYCLOAK_ISSUER.replace(":8080", "").replace(
                ":3000", ""
            )
            if token_issuer_base != expected_issuer_base:
                logger.warning(
                    f"Token issuer mismatch: got {token_issuer}, expected one of {expected_issuers}"
                )
                raise ValueError(
                    f"Token issuer {token_issuer} does not match expected issuer {KEYCLOAK_ISSUER}"
                )
            else:
                logger.debug(
                    f"Token issuer port difference accepted: {token_issuer} vs {KEYCLOAK_ISSUER}"
                )

        # Check audience manually with better error messages
        token_audience = claims.get("aud")
        if token_audience:
            # Handle both string and list audiences
            audiences = (
                token_audience if isinstance(token_audience, list) else [token_audience]
            )

            # Check if MCP_RESOURCE is in audience
            # Also check variations (with/without port, http/https) for flexibility
            mcp_resource_variations = [
                MCP_RESOURCE,
                MCP_RESOURCE.replace(":3000", "").replace(":8000", ""),  # Without port
                MCP_RESOURCE.replace("http://", "https://"),  # HTTPS variant
            ]

            if not any(variant in audiences for variant in mcp_resource_variations):
                # Allow client_id as fallback (for backward compatibility)
                client_id = claims.get("azp") or claims.get("client_id")
                if client_id and client_id in audiences:
                    logger.debug(
                        f"Token audience {audiences} doesn't include MCP resource, "
                        f"but client_id {client_id} matches. Allowing for backward compatibility."
                    )
                else:
                    logger.warning(
                        f"Token audience mismatch: expected {MCP_RESOURCE} (or variations), "
                        f"got {audiences}. Client ID: {client_id}. "
                        f"Token issuer: {claims.get('iss')}"
                    )
                    raise ValueError(
                        f"Token audience {audiences} does not match MCP resource {MCP_RESOURCE}. "
                        f"Configure Keycloak client scope with audience mapper for: {MCP_RESOURCE}"
                    )
            else:
                logger.debug(
                    f"Token audience validated: {audiences} includes MCP resource"
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
    """Return 401 with WWW-Authenticate header pointing to PRM endpoint and Keycloak authorization endpoint.

    Per RFC 9728 and MCP spec, ChatGPT will use resource_metadata from WWW-Authenticate header
    if present, otherwise it constructs the well-known URL by inserting .well-known/oauth-protected-resource
    between host and path.

    The scope parameter helps ChatGPT understand what scopes are required for this resource.

    Per RFC 9728, the resource parameter in WWW-Authenticate should match the resource identifier
    that the client is calling. ChatGPT sends resource=https://company.ashoksaravanan.com/mcp in auth requests,
    so we should include it in WWW-Authenticate to help ChatGPT recognize this as the protected resource.
    """
    # PRM endpoint URL - use root-level endpoint (works for both root and path-inserted discovery)
    prm_endpoint = f"{ORIGIN}{APP_PREFIX}/.well-known/oauth-protected-resource"
    # authorization_uri should point to the authorization server (Keycloak)
    auth_endpoint = f"{KEYCLOAK_ISSUER}/protocol/openid-connect/auth"
    # Include resource parameter to match what ChatGPT sends in authorization requests
    # This helps ChatGPT recognize this endpoint as the protected resource
    # Include scope to help ChatGPT understand what's required
    # Using mcp-resource scope which includes the audience claim
    return Response(
        status_code=status.HTTP_401_UNAUTHORIZED,
        headers={
            "WWW-Authenticate": f'Bearer realm="mcp", resource="{MCP_RESOURCE}", resource_metadata="{prm_endpoint}", authorization_uri="{auth_endpoint}", scope="mcp-resource"'
        },
    )


class McpOAuthMiddleware(BaseHTTPMiddleware):
    """Middleware for MCP OAuth authentication and feature flag gating."""

    async def dispatch(self, request: Request, call_next: Any) -> Response:
        """Process MCP requests with OAuth and feature flag checks."""
        # Allow OPTIONS requests (CORS preflight) to pass through without authentication
        # Cursor IDE and other browsers need this for CORS preflight checks
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        # RFC 8414 OAuth Authorization Server Metadata (REQUIRED for ChatGPT Dev Mode)
        # ChatGPT expects this endpoint to discover OAuth configuration
        # Handle this BEFORE /mcp path checks since it's at root level
        oauth_as_path = (
            f"{APP_PREFIX}/.well-known/oauth-authorization-server"
            if APP_PREFIX
            else "/.well-known/oauth-authorization-server"
        )

        # Handle RFC 8414 OAuth Authorization Server Metadata discovery (no auth required)
        # This is what ChatGPT Dev Mode uses to discover OAuth endpoints
        if path == oauth_as_path:
            # Return OAuth Authorization Server Metadata per RFC 8414
            # ChatGPT Dev Mode requires this to discover OAuth endpoints
            return JSONResponse(
                {
                    "issuer": KEYCLOAK_ISSUER,
                    "authorization_endpoint": f"{KEYCLOAK_ISSUER}/protocol/openid-connect/auth",
                    "token_endpoint": f"{KEYCLOAK_ISSUER}/protocol/openid-connect/token",
                    "registration_endpoint": f"{KEYCLOAK_ISSUER}/clients-registrations/openid-connect",
                    "scopes_supported": [
                        "openid",
                        "profile",
                        "email",
                        "address",
                        "phone",
                        "offline_access",
                        "organization",
                        "microprofile-jwt",
                        "mcp-resource",
                    ],
                    "response_types_supported": ["code"],
                    "grant_types_supported": ["authorization_code"],
                    "token_endpoint_auth_methods_supported": [
                        "client_secret_post",
                        "client_secret_basic",
                    ],
                    "code_challenge_methods_supported": [
                        "S256"
                    ],  # Required for ChatGPT PKCE support
                }
            )

        # Log all incoming requests to /mcp for debugging
        if path.startswith("/mcp") or path.startswith(f"{APP_PREFIX}/mcp"):
            all_headers = dict(request.headers)
            auth_header = all_headers.get("authorization", "NOT PRESENT")
            # Log full request details for debugging ChatGPT behavior
            # Also log ALL header values (not just keys) to see if token is in a different header
            header_values = {
                k: (v[:100] + "..." if len(str(v)) > 100 else v)
                for k, v in all_headers.items()
            }

            # Also check query parameters and URL for tokens (in case ChatGPT sends it differently)
            query_params = dict(request.query_params)
            url_str = str(request.url)

            logger.info(
                f"MCP request received: {request.method} {path}, "
                f"Authorization header present: {auth_header != 'NOT PRESENT'}, "
                f"Authorization value: {auth_header[:50] + '...' if len(str(auth_header)) > 50 and auth_header != 'NOT PRESENT' else auth_header}, "
                f"User-Agent: {all_headers.get('user-agent', 'N/A')}, "
                f"Query params: {list(query_params.keys())}, "
                f"Full URL contains 'token' or 'bearer': {'token' in url_str.lower() or 'bearer' in url_str.lower()}, "
                f"All headers and values: {json.dumps(header_values, indent=2)}"
            )

        # Build expected MCP paths
        mcp_path = f"{APP_PREFIX}/mcp" if APP_PREFIX else "/mcp"
        prm_path = (
            f"{APP_PREFIX}/.well-known/oauth-protected-resource"
            if APP_PREFIX
            else "/.well-known/oauth-protected-resource"
        )
        mcp_prm_path = f"{mcp_path}/.well-known/oauth-protected-resource"

        # Handle PRM discovery endpoint (no auth required) - check both locations
        # Per RFC 9728, ChatGPT may try path-insertion: /.well-known/oauth-protected-resource/mcp
        # Also handle root-level: /.well-known/oauth-protected-resource
        if (
            path == prm_path
            or path == mcp_prm_path
            or path.endswith("/.well-known/oauth-protected-resource")
            or path
            == "/.well-known/oauth-protected-resource/mcp"  # RFC 9728 path-insertion
            or (
                path.startswith("/.well-known/oauth-protected-resource/")
                and path.endswith("/mcp")
            )  # Handle path variations
        ):
            # Return PRM metadata per RFC 9728 and MCP spec
            # ChatGPT requires code_challenge_methods_supported and scopes_supported
            # Include mcp-resource in scopes_supported so ChatGPT knows this scope is available
            return JSONResponse(
                {
                    "resource": MCP_RESOURCE,
                    "authorization_servers": [KEYCLOAK_ISSUER],
                    "code_challenge_methods_supported": [
                        "S256"
                    ],  # Required for ChatGPT PKCE support
                    "scopes_supported": [
                        "openid",
                        "profile",
                        "email",
                        "address",
                        "phone",
                        "offline_access",
                        "organization",
                        "microprofile-jwt",
                        "mcp-resource",
                    ],  # Include mcp-resource so ChatGPT knows it's available
                }
            )

        # Only process /mcp paths
        # ChatGPT expects /mcp/sse/ endpoint (per OpenAI docs)
        # FastMCP handles SSE at /mcp, so /mcp/sse/ should also route to /mcp
        if not path.startswith(mcp_path) and not path.startswith("/mcp"):
            return await call_next(request)

        # Handle /mcp/sse/ path - ChatGPT expects this endpoint (per OpenAI docs)
        # FastMCP handles SSE at /mcp, so rewrite /mcp/sse/ to /mcp
        if path == f"{mcp_path}/sse/" or path == "/mcp/sse/":
            request.scope["path"] = mcp_path
            request.scope["raw_path"] = mcp_path.encode()
            # Continue to FastMCP which handles SSE at /mcp

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
            # Log all headers to debug why ChatGPT isn't sending Authorization
            all_headers = dict(request.headers)
            logger.info(
                f"MCP request missing Authorization header. "
                f"Request path: {request.url.path}, "
                f"Method: {request.method}, "
                f"Headers: {list(all_headers.keys())}, "
                f"User-Agent: {all_headers.get('user-agent', 'N/A')}"
            )
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
            logger.debug(f"Token validation error details: {e}", exc_info=True)
            return oauth_401()

        # Extract profile_id from OAuth claims and store in request.state.profile_id
        # This makes MCP endpoints consistent with HTTP API endpoints
        # Both use request.state.profile_id as the single source of truth
        from app.globals import get_pool
        from app.utils.mcp.get_profile_id_from_claims import get_profile_id_from_claims

        pool = get_pool()
        if pool:
            try:
                async with pool.acquire() as conn:
                    profile_id = await get_profile_id_from_claims(claims, conn)
                    if profile_id:
                        request.state.profile_id = profile_id
                        from app.utils.logging.db_logger import set_profile_id

                        set_profile_id(profile_id)
                        logger.debug(
                            f"MCP profile_id extracted from OAuth claims: {profile_id}"
                        )
                    else:
                        logger.warning(
                            f"MCP OAuth token valid but no matching profile found for email: {claims.get('email')}"
                        )
            except Exception as e:
                # Log error but don't fail the request - let endpoint handle missing profile_id
                logger.error(
                    f"Failed to extract profile_id from OAuth claims: {e}",
                    exc_info=True,
                )

        # Rewrite path for Cursor compatibility
        # Cursor expects /mcp/messages and /mcp/sse/messages
        # FastMCP handles requests at /mcp directly
        # So we rewrite these paths to /mcp before forwarding
        if path in [
            f"{mcp_path}/messages",
            f"{mcp_path}/sse/messages",
            "/mcp/messages",
            "/mcp/sse/messages",
        ]:
            # Rewrite the path to /mcp for FastMCP
            request.scope["path"] = mcp_path
            request.scope["raw_path"] = mcp_path.encode()

        # Continue to MCP server
        return await call_next(request)
