"""Unified identity resolution — single entry point for HTTP + Socket.IO.

Resolves a Bearer JWT token into a profile_id + session_id. Used by:
  - HTTP middleware (replaces get_profile_id + get_session_id dependencies)
  - Socket.IO connect handler (replaces query string params)
  - Background tasks (system session)

The JWT is issued by Keycloak (via default_idp or external IdP). The token
contains either a profile_id claim (from default_idp) or an email claim
(from external IdPs), which we resolve to a local profile_id.
"""

from __future__ import annotations

import logging
import os
import socket
import time
from dataclasses import dataclass
from typing import Any
from uuid import UUID

import asyncpg
import requests
from jose import jwt

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (same env vars as mcp/oauth.py)
# ---------------------------------------------------------------------------

ORIGIN = os.getenv("ORIGIN", "http://localhost")
APP_PREFIX = os.getenv("APP_PREFIX", "")
KEYCLOAK_INTERNAL_URL = os.getenv("KEYCLOAK_INTERNAL_URL", "http://keycloak:8080")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "master")
KEYCLOAK_ISSUER = f"{ORIGIN}{APP_PREFIX}/auth/realms/{KEYCLOAK_REALM}"

# JWKS URLs — try multiple endpoints for different environments
JWKS_URLS = [
    f"{KEYCLOAK_INTERNAL_URL}/auth/realms/{KEYCLOAK_REALM}/protocol/openid-connect/certs",
    "http://localhost:8080/auth/realms/master/protocol/openid-connect/certs",
    f"{KEYCLOAK_ISSUER}/protocol/openid-connect/certs",
]

# Also accept tokens from the built-in default-idp
origin_check = os.getenv("ORIGIN", "http://localhost:3000")
_is_local_dev = "localhost" in origin_check.lower()
_default_idp_base = (
    "http://localhost:8000" if _is_local_dev else ORIGIN
) + f"{APP_PREFIX}/default-idp"

# JWKS cache (shared across calls)
_jwks_cache: dict[str, Any] = {"keys": None, "ts": 0.0, "url": None}
_JWKS_TTL = 60  # seconds

# System session (created once at startup for background tasks)
_system_session_id: UUID | None = None


# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Identity:
    """Resolved identity from a JWT token."""

    profile_id: UUID
    session_id: UUID
    email: str | None = None
    role: str | None = None
    is_emulation: bool = False
    actor_profile_id: UUID | None = None


# ---------------------------------------------------------------------------
# JWKS fetching (reused from mcp/oauth.py pattern)
# ---------------------------------------------------------------------------


def _can_resolve_hostname(hostname: str) -> bool:
    try:
        socket.gethostbyname(hostname)
        return True
    except socket.gaierror:
        return False


def _get_jwks() -> list[dict[str, Any]]:
    """Get JWKS keys from Keycloak + default-idp with caching."""
    now = time.time()
    if _jwks_cache["keys"] is not None and now - _jwks_cache["ts"] <= _JWKS_TTL:
        return _jwks_cache["keys"]

    all_keys: list[dict[str, Any]] = []

    # Fetch from Keycloak
    urls_to_try = []
    for url in JWKS_URLS:
        if "keycloak:8080" in url and not _can_resolve_hostname("keycloak"):
            continue
        urls_to_try.append(url)

    for jwks_url in urls_to_try:
        try:
            response = requests.get(jwks_url, timeout=5)
            response.raise_for_status()
            keys = response.json().get("keys", [])
            if keys:
                all_keys.extend(keys)
                logger.debug(f"Fetched {len(keys)} keys from {jwks_url}")
                break
        except Exception as e:
            logger.debug(f"Failed to fetch JWKS from {jwks_url}: {e}")
            continue

    # Also include default-idp keys
    try:
        from app.routes.default_idp.jwks import get_jwks as get_default_idp_jwks

        default_keys = get_default_idp_jwks().get("keys", [])
        all_keys.extend(default_keys)
    except Exception as e:
        logger.debug(f"Failed to get default-idp JWKS: {e}")

    if all_keys:
        _jwks_cache["keys"] = all_keys
        _jwks_cache["ts"] = now
        return all_keys

    # Fall back to cached keys if available
    if _jwks_cache["keys"] is not None:
        logger.warning("Failed to refresh JWKS, using cached keys")
        return _jwks_cache["keys"]

    raise RuntimeError("Failed to fetch JWKS from all endpoints")


# ---------------------------------------------------------------------------
# JWT verification
# ---------------------------------------------------------------------------


def verify_jwt(token: str) -> dict[str, Any]:
    """Verify a JWT token and return its claims.

    Accepts tokens from Keycloak or the built-in default-idp.

    Raises:
        ValueError: If token is invalid, expired, or unverifiable.
    """
    try:
        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")
        if not kid:
            raise ValueError("Token missing kid header")

        keys = _get_jwks()
        key = next((k for k in keys if k.get("kid") == kid), None)
        if not key:
            raise ValueError(f"No matching JWK found for kid={kid}")

        claims = jwt.decode(
            token,
            key,
            algorithms=[headers.get("alg", "RS256")],
            options={
                "verify_at_hash": False,
                "verify_aud": False,
                "verify_iss": False,
            },
        )

        # Validate issuer — accept Keycloak and default-idp issuers
        token_issuer = claims.get("iss", "")
        expected_issuers = [
            KEYCLOAK_ISSUER,
            f"{KEYCLOAK_INTERNAL_URL}/auth/realms/{KEYCLOAK_REALM}",
            "http://localhost:8080/auth/realms/master",
            _default_idp_base,
        ]

        if token_issuer and not any(
            _issuer_matches(token_issuer, expected) for expected in expected_issuers
        ):
            logger.warning(
                f"Token issuer mismatch: got {token_issuer}, "
                f"expected one of {expected_issuers}"
            )
            raise ValueError(f"Token issuer {token_issuer} not recognized")

        return claims

    except jwt.ExpiredSignatureError as e:
        raise ValueError("Token expired") from e
    except jwt.JWTClaimsError as e:
        raise ValueError(f"Token claims invalid: {e}") from e
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Token verification failed: {e}") from e


def _issuer_matches(actual: str, expected: str) -> bool:
    """Flexible issuer comparison (handles port differences in dev)."""
    if actual == expected:
        return True
    # Strip common dev ports for comparison
    actual_norm = actual.replace(":8080", "").replace(":3000", "").replace(":8000", "")
    expected_norm = (
        expected.replace(":8080", "").replace(":3000", "").replace(":8000", "")
    )
    return actual_norm == expected_norm


# ---------------------------------------------------------------------------
# Identity resolution
# ---------------------------------------------------------------------------


async def resolve_identity(token: str, conn: asyncpg.Connection) -> Identity:
    """Resolve a Bearer JWT token to a full Identity.

    1. Verify JWT signature
    2. Extract profile_id from claims (direct or via email lookup)
    3. Get or create a session for this profile

    Args:
        token: JWT token string (without "Bearer " prefix)
        conn: Database connection

    Returns:
        Identity with profile_id, session_id, and metadata

    Raises:
        ValueError: If token is invalid or profile cannot be resolved
    """
    claims = verify_jwt(token)

    # Resolve profile_id
    profile_id = await _resolve_profile_id(claims, conn)
    if profile_id is None:
        raise ValueError(
            f"No profile found for token claims (email={claims.get('email')})"
        )

    # Get or create session for this profile
    session_id = await _get_or_create_session(conn, profile_id)

    return Identity(
        profile_id=profile_id,
        session_id=session_id,
        email=claims.get("email"),
        role=claims.get("role"),
        is_emulation=claims.get("is_emulation", False),
        actor_profile_id=(
            UUID(claims["actor_profile_id"]) if claims.get("actor_profile_id") else None
        ),
    )


async def _resolve_profile_id(
    claims: dict[str, Any], conn: asyncpg.Connection
) -> UUID | None:
    """Extract profile_id from JWT claims.

    Strategy:
    1. Direct profile_id claim (from default_idp tokens)
    2. Email lookup (from external IdP tokens)
    """
    # Strategy 1: Direct profile_id in claims (default_idp puts it there)
    direct_id = claims.get("profile_id")
    if direct_id:
        try:
            return UUID(direct_id)
        except ValueError:
            pass

    # Strategy 2: Look up by email
    email = claims.get("email")
    if not email:
        return None

    row = await conn.fetchrow(
        """
        SELECT p.id as profile_id
        FROM profile_artifact p
        JOIN profile_emails_junction pe ON pe.profile_id = p.id
        JOIN emails_resource e ON pe.email_id = e.id
        WHERE e.email = $1
        LIMIT 1
        """,
        email,
    )

    return row["profile_id"] if row else None


async def _get_or_create_session(conn: asyncpg.Connection, profile_id: UUID) -> UUID:
    """Get the most recent active session for a profile, or create one."""
    # Check for recent active session (within last 24h)
    row = await conn.fetchrow(
        """
        SELECT se.id
        FROM sessions_entry se
        JOIN profiles_sessions_connection psc ON psc.session_id = se.id
        WHERE psc.profiles_id = $1
          AND se.active = true
          AND se.created_at > now() - interval '24 hours'
        ORDER BY se.created_at DESC
        LIMIT 1
        """,
        profile_id,
    )

    if row:
        return row["id"]

    # Create new session
    from app.routes.v5.tools.entries.sessions.create import create_session

    result = await create_session(conn, profile_id=profile_id)
    return result.id


# ---------------------------------------------------------------------------
# System session (for background tasks like health checks, metrics)
# ---------------------------------------------------------------------------


async def get_system_session_id(conn: asyncpg.Connection) -> UUID:
    """Get or create a system session for background tasks.

    This session is not tied to a user profile. It's used by the metrics
    collector, health check logger, and other server-internal processes.
    """
    global _system_session_id

    if _system_session_id is not None:
        # Verify it still exists
        exists = await conn.fetchval(
            "SELECT id FROM sessions_entry WHERE id = $1 AND active = true",
            _system_session_id,
        )
        if exists:
            return _system_session_id

    # Create a system session (no profile link needed)
    session_id = await conn.fetchval(
        """
        INSERT INTO sessions_entry (active, mcp, generated)
        VALUES (true, false, true)
        RETURNING id
        """
    )

    _system_session_id = session_id
    logger.info(f"Created system session: {session_id}")
    return session_id


# ---------------------------------------------------------------------------
# Token extraction helpers
# ---------------------------------------------------------------------------


def extract_bearer_token(authorization: str | None) -> str | None:
    """Extract token from 'Bearer <token>' Authorization header."""
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def extract_api_key(header_value: str | None) -> str | None:
    """Extract API key from X-Api-Key header."""
    if not header_value:
        return None
    return header_value.strip()
