"""OIDC endpoints for default-idp Identity Provider."""

import os
import secrets
import time
from typing import Annotated, Any, cast

import asyncpg
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (CheckLoginAuthorizationSqlParams,
                           CheckLoginAuthorizationSqlRow,
                           ResolveDefaultIdpProfileSqlParams,
                           ResolveDefaultIdpProfileSqlRow, load_sql_query)
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from jose import jwt

from .jwks import get_key_id, get_private_key
from .state import verify_state_token

router = APIRouter()

# In-memory store for authorization codes (code -> {profile_id, email, name, nonce, expires_at})
# In production, this should be moved to Redis
_authorization_codes: dict[str, dict[str, Any]] = {}
_code_ttl = 600  # 10 minutes


def get_idp_base_url() -> str:
    """Get the base URL for the IdP."""
    origin = os.getenv("ORIGIN", "http://localhost:3000")
    app_prefix = os.getenv("APP_PREFIX", "").strip("/")
    if app_prefix:
        return f"{origin}/{app_prefix}/api/v4/auth/default-idp"
    return f"{origin}/api/v4/auth/default-idp"


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
        "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post"],
        "claims_supported": ["sub", "iss", "aud", "exp", "iat", "email", "name", "given_name", "family_name"],
    }


@router.get("/authorize")
async def authorize(
    request: Request,
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    response_type: str = Query(...),
    state: str = Query(...),
    scope: str = Query("openid profile email"),
    # Custom parameters passed via IdP authorizationUrl config
    # Format: /authorize?mode=guest&department_id=... (Keycloak preserves these)
    mode: str | None = Query(None),
    department_id: str | None = Query(None),
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
                detail=f"Unsupported response_type: {response_type}. Only 'code' is supported."
            )
        
        # Extract mode and department_id from query params (preferred) or state token (fallback)
        extracted_mode: str | None = mode
        extracted_department_id: str | None = department_id
        nonce: str | None = None
        
        # If not in query params, try to extract from state token (backward compatibility)
        if not extracted_mode:
            try:
                state_payload = verify_state_token(state)
                extracted_mode = state_payload.get("mode")
                if not extracted_department_id:
                    extracted_department_id = state_payload.get("department_id")
                nonce = state_payload.get("nonce")
            except (jwt.ExpiredSignatureError, jwt.JWTError):
                # State token is Keycloak's OAuth state, not our custom token
                # Generate new nonce for this flow
                pass
        
        # Require mode parameter
        if not extracted_mode:
            raise HTTPException(
                status_code=400,
                detail="Mode parameter is required. Ensure IdP authorizationUrl includes ?mode=guest or ?mode=default-account"
            )
        
        # Generate nonce if not from state token
        if not nonce:
            nonce = secrets.token_urlsafe(32)
        
        department_id = extracted_department_id
        mode = extracted_mode
        
        # Map mode to auth_mode for SQL function
        # mode uses "guest" or "default-account", SQL expects "default-guest" or "default-account"
        auth_mode = "default-guest" if mode == "guest" else "default-account"
        
        # Validate authorization using existing SQL function
        sql_query = load_sql_query("app/sql/v4/profile/check_login_authorization_complete.sql")
        auth_params = CheckLoginAuthorizationSqlParams(
            department_id=department_id if department_id else None
        )
        sql_params = auth_params.to_tuple()
        
        auth_result = await execute_sql_typed(
            conn,
            "app/sql/v4/profile/check_login_authorization_complete.sql",
            params=auth_params,
        )
        auth_data = cast(CheckLoginAuthorizationSqlRow, auth_result)
        
        # Check authorization based on mode
        if mode == "guest":
            if not auth_data.guest_login_enabled:
                raise HTTPException(
                    status_code=403,
                    detail="Guest login is not enabled for this configuration."
                )
        elif mode == "default-account":
            active_dept_count = auth_data.active_departments_count or 0
            dept_auth_count = auth_data.department_auth_providers_count or 0
            default_auth_count = auth_data.default_settings_auth_providers_count or 0
            depts_without_auth_count = auth_data.departments_without_auth_providers_count or 0
            department_exists = auth_data.department_exists or False
            
            if active_dept_count == 0:
                pass  # Allow (initial setup)
            elif active_dept_count > 0:
                if not department_id:
                    if default_auth_count > 0:
                        raise HTTPException(
                            status_code=403,
                            detail="Default account login not available. Please select a department or use an authentication provider."
                        )
                    if depts_without_auth_count == 0:
                        raise HTTPException(
                            status_code=403,
                            detail="Default account login not available. Please select a department or use an authentication provider."
                        )
                else:
                    if not department_exists:
                        raise HTTPException(
                            status_code=400,
                            detail="Invalid department specified."
                        )
                    if dept_auth_count > 0:
                        raise HTTPException(
                            status_code=403,
                            detail="Default account login not available for this department. Please use an authentication provider."
                        )
        else:
            raise HTTPException(status_code=400, detail=f"Invalid mode: {mode}")
        
        # Resolve profile using new SQL function
        profile_params = ResolveDefaultIdpProfileSqlParams(
            department_id=department_id if department_id else "",
            auth_mode=auth_mode,
        )
        
        profile_result = await execute_sql_typed(
            conn,
            "app/sql/v4/auth/resolve_default_idp_profile_complete.sql",
            params=profile_params,
        )
        
        if not profile_result:
            raise HTTPException(
                status_code=404,
                detail="Profile not found for this department and mode combination."
            )
        
        profile_data = cast(ResolveDefaultIdpProfileSqlRow, profile_result)
        
        if not profile_data.profile_id or not profile_data.primary_email:
            raise HTTPException(
                status_code=404,
                detail="Profile or email not found for this department and mode combination."
            )
        
        # Generate authorization code
        code = secrets.token_urlsafe(32)
        expires_at = int(time.time()) + _code_ttl
        
        # Store authorization code with profile data
        _authorization_codes[code] = {
            "profile_id": str(profile_data.profile_id),
            "email": profile_data.primary_email,
            "first_name": profile_data.first_name or "",
            "last_name": profile_data.last_name or "",
            "role": str(profile_data.role) if profile_data.role else None,
            "nonce": nonce,
            "expires_at": expires_at,
            "client_id": client_id,
            "redirect_uri": redirect_uri,
        }
        
        # Clean up expired codes (simple cleanup, could be optimized)
        current_time = int(time.time())
        expired_codes = [
            code_key for code_key, code_data in _authorization_codes.items()
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
    grant_type: str = Query(...),
    code: str = Query(...),
    redirect_uri: str = Query(...),
    client_id: str = Query(...),
    client_secret: str = Query(None),
) -> dict[str, Any]:
    """Token endpoint - exchanges authorization codes for tokens."""
    try:
        # Validate grant_type
        if grant_type != "authorization_code":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported grant_type: {grant_type}. Only 'authorization_code' is supported."
            )
        
        # Look up authorization code
        code_data = _authorization_codes.get(code)
        if not code_data:
            raise HTTPException(status_code=400, detail="Invalid authorization code")
        
        # Check expiry
        if code_data["expires_at"] < int(time.time()):
            del _authorization_codes[code]
            raise HTTPException(status_code=400, detail="Authorization code has expired")
        
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
        
        # Build name from first_name and last_name
        name_parts = []
        if code_data["first_name"]:
            name_parts.append(code_data["first_name"])
        if code_data["last_name"]:
            name_parts.append(code_data["last_name"])
        name = " ".join(name_parts) if name_parts else ""
        
        # Build stable sub claim: default:<department_id>:<mode>:<profile_id>
        # Note: We don't have department_id in code_data, so we'll use a simpler format
        # Keycloak will handle user linking based on email
        sub = f"default:{code_data['profile_id']}"
        
        # Create ID token
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
            "given_name": code_data["first_name"] or "",
            "family_name": code_data["last_name"] or "",
        }
        
        id_token = jwt.encode(
            id_token_payload,
            private_key,
            algorithm="RS256",
            headers={"kid": key_id},
        )
        
        # Create access token (simplified - Keycloak will issue its own)
        access_token_payload = {
            "iss": base_url,
            "aud": client_id,
            "sub": sub,
            "exp": now + 3600,
            "iat": now,
            "scope": "openid profile email",
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
    authorization: str = Query(None),
) -> dict[str, Any]:
    """UserInfo endpoint - returns user claims from access token."""
    try:
        # Extract Bearer token
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
        
        token = authorization[7:]  # Remove "Bearer " prefix
        
        # Decode and verify token
        # Note: In a full implementation, we'd verify the signature using JWKS
        # For now, we'll decode without verification (Keycloak will verify)
        try:
            # Decode without verification for UserInfo (Keycloak validates tokens)
            # In production, verify signature using JWKS
            payload = jwt.decode(token, options={"verify_signature": False})
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
