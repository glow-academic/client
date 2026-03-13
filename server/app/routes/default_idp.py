"""Default OIDC Identity Provider — /default-idp/* endpoints."""

import secrets
import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Form, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from jose import jwt

from app.infra.globals import get_pool, get_redis_client
from app.infra.identity.jwks import get_jwks, get_key_id, get_private_key
from app.tools.v5.artifacts.profile.get import (
    get_profiles as get_profile_artifacts,
)
from app.tools.v5.entries.emulations.search import search_emulations
from app.tools.v5.entries.grant_consumptions.create import (
    create_grant_consumption,
)
from app.tools.v5.entries.grant_consumptions.search import (
    search_grant_consumptions,
)
from app.tools.v5.entries.grants.get import get_grants
from app.tools.v5.resources.profiles.get import (
    get_profiles as get_profile_resources,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter(prefix="/default-idp", tags=["default-idp"])

# In-memory store for authorization codes (code -> {profile_id, email, name, nonce, expires_at})
_authorization_codes: dict[str, dict[str, Any]] = {}
_code_ttl = 600  # 10 minutes


def get_idp_base_url() -> str:
    """Get the base URL for the IdP (public URL for issuer)."""
    from app.infra.identity.keycloak_sync import get_idp_public_url

    return get_idp_public_url()


@router.get("/jwks")
async def jwks_endpoint():
    """JWKS endpoint for public key exposure."""
    return get_jwks()


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
    nonce: str | None = Query(None),
    profile_id: UUID | None = Query(None),
    emulation_grant: UUID | None = Query(None),
    login_hint: str | None = Query(None),
) -> RedirectResponse:
    """Authorization endpoint - handles Keycloak broker redirects."""
    try:
        if response_type != "code":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported response_type: {response_type}. Only 'code' is supported.",
            )

        if not nonce:
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

        actor_profile_id: UUID | None = None

        pool = get_pool()

        if emulation_grant is not None:
            async with pool.acquire() as conn:
                grants = await get_grants(conn, ids=[emulation_grant])
                if not grants:
                    raise HTTPException(
                        status_code=404,
                        detail="Emulation grant not found.",
                    )

                grant = grants[0]
                if grant.expires_at <= datetime.now(UTC):
                    raise HTTPException(
                        status_code=403,
                        detail="Grant expired.",
                    )

                consumptions = await search_grant_consumptions(
                    conn, grant_ids=[emulation_grant], limit=1
                )
                if consumptions:
                    raise HTTPException(
                        status_code=403,
                        detail="Grant already used.",
                    )

                await create_grant_consumption(conn, grant_id=emulation_grant)
                actor_profile_id = grant.profiles_id

                emulations = await search_emulations(
                    conn, grant_ids=[emulation_grant], limit=1
                )
                if emulations:
                    resolved_profile_id = emulations[0].profile_id

        if resolved_profile_id is None:
            raise HTTPException(
                status_code=400,
                detail="Missing profile_id for default IdP login.",
            )

        async with pool.acquire() as conn:
            artifacts = await get_profile_artifacts(
                conn, ids=[resolved_profile_id], profiles=True
            )
            if not artifacts or not artifacts[0].profile_ids:
                raise HTTPException(
                    status_code=404,
                    detail="Profile not found for this default IdP login.",
                )

            redis = get_redis_client()
            resources = await get_profile_resources(
                conn, ids=artifacts[0].profile_ids, redis=redis, bypass_cache=True
            )
            if not resources or not resources[0].primary_email:
                raise HTTPException(
                    status_code=404,
                    detail="Profile or email not found for this default IdP login.",
                )

        profile = resources[0]

        code = secrets.token_urlsafe(32)
        expires_at = int(time.time()) + _code_ttl

        is_emulation = emulation_grant is not None
        _authorization_codes[code] = {
            "profile_id": str(resolved_profile_id),
            "email": profile.primary_email,
            "name": profile.name or "",
            "role": profile.role if profile.role else None,
            "nonce": nonce,
            "expires_at": expires_at,
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "is_emulation": is_emulation,
            "actor_profile_id": str(actor_profile_id) if actor_profile_id else None,
        }

        current_time = int(time.time())
        expired_codes = [
            code_key
            for code_key, code_data in _authorization_codes.items()
            if code_data["expires_at"] < current_time
        ]
        for expired_code in expired_codes:
            del _authorization_codes[expired_code]

        redirect_url = f"{redirect_uri}?code={code}&state={state}"
        return RedirectResponse(url=redirect_url)

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="authorize",
            sql_query=None,
            sql_params=None,
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
        if grant_type != "authorization_code":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported grant_type: {grant_type}. Only 'authorization_code' is supported.",
            )

        code_data = _authorization_codes.get(code)
        if not code_data:
            raise HTTPException(status_code=400, detail="Invalid authorization code")

        if code_data["expires_at"] < int(time.time()):
            del _authorization_codes[code]
            raise HTTPException(
                status_code=400, detail="Authorization code has expired"
            )

        if code_data["client_id"] != client_id:
            raise HTTPException(status_code=400, detail="Invalid client_id")

        if code_data["redirect_uri"] != redirect_uri:
            raise HTTPException(status_code=400, detail="Invalid redirect_uri")

        del _authorization_codes[code]

        base_url = get_idp_base_url()
        now = int(time.time())
        key_id = get_key_id()
        private_key = get_private_key()

        name = code_data["name"]
        name_parts = name.split()
        given_name = name_parts[0] if name_parts else ""
        family_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

        sub = f"default_{code_data['profile_id']}"

        id_token_payload = {
            "iss": base_url,
            "aud": client_id,
            "sub": sub,
            "exp": now + 3600,
            "iat": now,
            "nonce": code_data["nonce"],
            "email": code_data["email"],
            "email_verified": True,
            "name": name,
            "given_name": given_name,
            "family_name": family_name,
            "profile_id": code_data["profile_id"],
            "role": code_data.get("role"),
            "is_emulation": code_data.get("is_emulation", False),
            "actor_profile_id": code_data.get("actor_profile_id"),
        }

        id_token = jwt.encode(
            id_token_payload,
            private_key,
            algorithm="RS256",
            headers={"kid": key_id},
        )

        access_token_payload = {
            "iss": base_url,
            "aud": client_id,
            "sub": sub,
            "exp": now + 3600,
            "iat": now,
            "scope": "openid profile email",
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
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401, detail="Missing or invalid authorization header"
            )

        token = authorization[7:]

        try:
            payload = jwt.decode(
                token,
                key="",
                options={"verify_signature": False, "verify_aud": False},
            )
        except jwt.JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

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
