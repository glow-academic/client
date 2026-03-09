"""Unified auth middleware — replaces get_profile_id + get_session_id dependencies.

Validates license key (X-Api-Key) and JWT (Authorization: Bearer) on every request,
then sets request.state.profile_id and request.state.session_id.

The client no longer needs to send X-Profile-Id or X-Session-Id headers.
"""

from __future__ import annotations

import logging

from fastapi import Header, HTTPException, Request

from app.infra.auth.license_key import validate_license_key
from app.infra.auth.resolve_identity import (
    Identity,
    extract_api_key,
    extract_bearer_token,
    resolve_identity,
)
from app.infra.globals import get_pool

logger = logging.getLogger(__name__)


async def require_auth(
    request: Request,
    x_api_key: str | None = Header(default=None, alias="X-Api-Key"),
    authorization: str | None = Header(default=None),
) -> Identity:
    """FastAPI dependency that validates auth and resolves identity.

    Requires:
      - X-Api-Key header (license key, always required)
      - Authorization: Bearer <jwt> (user identity, always required)

    Sets on request.state:
      - profile_id: UUID
      - session_id: UUID
      - identity: full Identity object

    Raises:
        HTTPException 401 if auth is missing or invalid
    """
    # 1. Validate license key
    api_key = extract_api_key(x_api_key)
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Api-Key header",
        )

    license_info = await validate_license_key(api_key)
    if not license_info.valid:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid license key: {license_info.error}",
        )

    # 2. Validate JWT and resolve identity
    token = extract_bearer_token(authorization)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization: Bearer <token> header",
        )

    pool = get_pool()
    try:
        identity = await resolve_identity(token, pool)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e

    # 3. Set on request.state (backward-compatible with existing code)
    request.state.profile_id = str(identity.profile_id)
    request.state.session_id = str(identity.session_id)
    request.state.identity = identity

    return identity
