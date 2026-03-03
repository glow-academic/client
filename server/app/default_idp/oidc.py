"""OIDC endpoints for default-idp Identity Provider."""

import secrets
import time
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Form, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from jose import jwt

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import (
    ConsumeEmulationGrantSqlParams,
    ConsumeEmulationGrantSqlRow,
    ResolveDefaultIdpProfileSqlParams,
    ResolveDefaultIdpProfileSqlRow,
    load_sql_query,
)
from app.utils.sql_helper import execute_sql_typed

from .jwks import get_key_id, get_private_key

router = APIRouter()

# In-memory store for authorization codes (code -> {profile_id, email, name, nonce, expires_at})
# In production, this should be moved to Redis
_authorization_codes: dict[str, dict[str, Any]] = {}
_code_ttl = 600  # 10 minutes


def get_idp_base_url() -> str:
    """Get the base URL for the IdP (public URL for issuer).

    Uses the same logic as keycloak_sync.py get_idp_public_url().
    This URL is used in the issuer claim and must be accessible from browsers.
    """
    from app.v5.infra.auth.keycloak_sync import get_idp_public_url

    return get_idp_public_url()


@router.get("/.well-known/openid-configuration")
async def openid_configuration() -> dict[str, Any]:
    """OIDC discovery endpoint."""
    base_url = get_idp_base_url()

    return {
        "issuer": base_url,
        "authorization_endpoint": f"{base_url}/authorize",
        "token_endpoint": f"{base_url}/token",
        "jwks_uri": f"{base_url}/jwks",
        "userinfo_endpoint": f"{base_url}/userinfo",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "scopes_supported": ["openid", "profile", "email"],
        "token_endpoint_auth_methods_supported": [
            "client_secret_basic",
            "client_secret_post",
        ],
        "claims_supported": [
            "sub",
            "iss",
            "aud",
            "exp",
            "iat",
            "email",
            "name",
            "given_name",
            "family_name",
        ],
    }


@router.get("/authorize")
async def authorize(
    request: Request,
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    response_type: str = Query(...),
    state: str = Query(...),
    scope: str = Query("openid profile email"),
    nonce: str | None = Query(
        None
    ),  # Extract nonce from Keycloak's authorization request
    profile_id: UUID | None = Query(None),
    emulation_grant: UUID | None = Query(None),
    login_hint: str | None = Query(None),
    conn: Annotated[asyncpg.Connection, Depends(get_db)] = None,
) -> RedirectResponse:
    """Authorization endpoint - handles Keycloak broker redirects."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Validate response_type
        if response_type != "code":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported response_type: {response_type}. Only 'code' is supported.",
            )

        # Use nonce from Keycloak's request if provided, otherwise generate one
        # Keycloak typically sends nonce for OIDC flows, but we'll handle both cases
        if not nonce:
            # Generate nonce if Keycloak didn't provide one (shouldn't happen in normal OIDC flow)
            nonce = secrets.token_urlsafe(32)

        resolved_profile_id = profile_id
        if emulation_grant is None and login_hint:
            try:
                emulation_grant = UUID(login_hint)
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid emulation grant token.",
                )

        if emulation_grant is not None:
            sql_query = load_sql_query(
                "app/sql/queries/auth/consume_emulation_grant_complete.sql"
            )
            grant_params = ConsumeEmulationGrantSqlParams(
                grant_id=emulation_grant,
            )
            sql_params = grant_params.to_tuple()

            grant_result = await execute_sql_typed(
                conn,
                "app/sql/queries/auth/consume_emulation_grant_complete.sql",
                params=grant_params,
            )
            if not grant_result:
                raise HTTPException(
                    status_code=404,
                    detail="Emulation grant not found.",
                )

            grant_data = cast(ConsumeEmulationGrantSqlRow, grant_result)
            if not grant_data.ok or not grant_data.target_profile_id:
                raise HTTPException(
                    status_code=403,
                    detail=grant_data.reason or "Emulation grant invalid.",
                )

            resolved_profile_id = grant_data.target_profile_id

        if resolved_profile_id is None:
            raise HTTPException(
                status_code=400,
                detail="Missing profile_id for default IdP login.",
            )

        # Resolve profile using new SQL function
        sql_query = load_sql_query(
            "app/sql/queries/auth/resolve_default_idp_profile_complete.sql"
        )
        profile_params = ResolveDefaultIdpProfileSqlParams(
            p_profile_id=resolved_profile_id,
        )
        sql_params = profile_params.to_tuple()

        profile_result = await execute_sql_typed(
            conn,
            "app/sql/queries/auth/resolve_default_idp_profile_complete.sql",
            params=profile_params,
        )

        if not profile_result:
            raise HTTPException(
                status_code=404, detail="Profile not found for this default IdP login."
            )

        profile_data = cast(ResolveDefaultIdpProfileSqlRow, profile_result)

        if not profile_data.profile_id or not profile_data.primary_email:
            raise HTTPException(
                status_code=404,
                detail="Profile or email not found for this default IdP login.",
            )

        # Generate authorization code
        code = secrets.token_urlsafe(32)
        expires_at = int(time.time()) + _code_ttl

        # Determine if this is an emulation flow
        is_emulation = emulation_grant is not None
        actor_profile_id = None
        if is_emulation and "grant_data" in dir() and grant_data:
            actor_profile_id = (
                str(grant_data.actor_profile_id)
                if grant_data.actor_profile_id
                else None
            )

        # Store authorization code with profile data (including emulation context)
        _authorization_codes[code] = {
            "profile_id": str(profile_data.profile_id),
            "email": profile_data.primary_email,
            "name": profile_data.name or "",
            "role": str(profile_data.role) if profile_data.role else None,
            "nonce": nonce,
            "expires_at": expires_at,
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            # Emulation context
            "is_emulation": is_emulation,
            "actor_profile_id": actor_profile_id,
        }

        # Clean up expired codes (simple cleanup, could be optimized)
        current_time = int(time.time())
        expired_codes = [
            code_key
            for code_key, code_data in _authorization_codes.items()
            if code_data["expires_at"] < current_time
        ]
        for expired_code in expired_codes:
            del _authorization_codes[expired_code]

        # Redirect back to Keycloak with authorization code
        redirect_url = f"{redirect_uri}?code={code}&state={state}"
        return RedirectResponse(url=redirect_url)

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="authorize",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )


@router.post("/token")
async def token(
    request: Request,
    grant_type: str = Form(...),
    code: str = Form(...),
    redirect_uri: str = Form(...),
    client_id: str = Form(...),
    client_secret: str = Form(None),
) -> dict[str, Any]:
    """Token endpoint - exchanges authorization codes for tokens."""
    try:
        # Validate grant_type
        if grant_type != "authorization_code":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported grant_type: {grant_type}. Only 'authorization_code' is supported.",
            )

        # Look up authorization code
        code_data = _authorization_codes.get(code)
        if not code_data:
            raise HTTPException(status_code=400, detail="Invalid authorization code")

        # Check expiry
        if code_data["expires_at"] < int(time.time()):
            del _authorization_codes[code]
            raise HTTPException(
                status_code=400, detail="Authorization code has expired"
            )

        # Validate client_id and redirect_uri match
        if code_data["client_id"] != client_id:
            raise HTTPException(status_code=400, detail="Invalid client_id")

        if code_data["redirect_uri"] != redirect_uri:
            raise HTTPException(status_code=400, detail="Invalid redirect_uri")

        # Remove used code (one-time use)
        del _authorization_codes[code]

        # Generate tokens
        base_url = get_idp_base_url()
        now = int(time.time())
        key_id = get_key_id()
        private_key = get_private_key()

        name = code_data["name"]
        name_parts = name.split()
        given_name = name_parts[0] if name_parts else ""
        family_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        # Build stable sub claim using underscore (colon is invalid in Keycloak usernames)
        # Format: default_<profile_id>
        # Keycloak will handle user linking based on email
        sub = f"default_{code_data['profile_id']}"

        # Create ID token with emulation context
        id_token_payload = {
            "iss": base_url,
            "aud": client_id,
            "sub": sub,
            "exp": now + 3600,  # 1 hour
            "iat": now,
            "nonce": code_data["nonce"],
            "email": code_data["email"],
            "email_verified": True,
            "name": name,
            "given_name": given_name,
            "family_name": family_name,
            # Custom claims for direct profile resolution (bypasses email lookup)
            "profile_id": code_data["profile_id"],
            "role": code_data.get("role"),
            # Emulation context - allows client to know this is an emulated session
            "is_emulation": code_data.get("is_emulation", False),
            "actor_profile_id": code_data.get("actor_profile_id"),
        }

        id_token = jwt.encode(
            id_token_payload,
            private_key,
            algorithm="RS256",
            headers={"kid": key_id},
        )

        # Create access token with user claims (needed for userinfo endpoint)
        access_token_payload = {
            "iss": base_url,
            "aud": client_id,
            "sub": sub,
            "exp": now + 3600,
            "iat": now,
            "scope": "openid profile email",
            # Include user claims so userinfo can return them
            "email": code_data["email"],
            "name": name,
            "given_name": given_name,
            "family_name": family_name,
        }

        access_token = jwt.encode(
            access_token_payload,
            private_key,
            algorithm="RS256",
            headers={"kid": key_id},
        )

        return {
            "access_token": access_token,
            "token_type": "Bearer",
            "id_token": id_token,
            "expires_in": 3600,
        }

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="token",
            sql_query=None,
            sql_params=None,
            request=request,
        )


@router.get("/userinfo")
async def userinfo(
    request: Request,
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """UserInfo endpoint - returns user claims from access token."""
    try:
        # Extract Bearer token from Authorization header
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401, detail="Missing or invalid authorization header"
            )

        token = authorization[7:]  # Remove "Bearer " prefix

        # Decode and verify token
        # Note: In a full implementation, we'd verify the signature using JWKS
        # For now, we'll decode without verification (Keycloak will verify)
        try:
            # Decode without verification for UserInfo (Keycloak validates tokens)
            # python-jose requires a key even with verify_signature=False
            payload = jwt.decode(
                token,
                key="",  # Empty key since we're not verifying
                options={"verify_signature": False, "verify_aud": False},
            )
        except jwt.JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

        # Return user claims
        return {
            "sub": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "given_name": payload.get("given_name"),
            "family_name": payload.get("family_name"),
        }

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="userinfo",
            sql_query=None,
            sql_params=None,
            request=request,
        )
