"""Profile emulation endpoint - issue default-idp emulation grant."""

from typing import Annotated, Any, cast

import asyncpg
import os
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreateEmulationGrantApiRequest,
    CreateEmulationGrantApiResponse,
    CreateEmulationGrantSqlParams,
    CreateEmulationGrantSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/auth/create_emulation_grant_complete.sql"

router = APIRouter()


@router.post(
    "/emulate",
    response_model=CreateEmulationGrantApiResponse,
    dependencies=[
        audit_activity("profile.emulate", "{{ actor.name }} authorized emulation")
    ],
)
async def authorize_emulation(
    request: CreateEmulationGrantApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateEmulationGrantApiResponse:
    """Create emulation grant and return default-idp redirect URL."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        requester_profile_id = getattr(http_request.state, "profile_id", None)
        if requester_profile_id is None:
            raise HTTPException(status_code=401, detail="Missing requester profile")

        origin = os.getenv("ORIGIN", "http://localhost:3000").rstrip("/")
        app_prefix = os.getenv("APP_PREFIX", "").strip("/")
        prefix = f"/{app_prefix}" if app_prefix else ""
        signin_base_url = f"{origin}{prefix}/api/auth/signin/keycloak"
        callback_url = quote(f"{origin}{prefix}/", safe="")
        # Use single default-idp for all emulation flows (hidden from login, handles all profiles)
        # The grant ID passed via login_hint contains target_profile_id
        idp_alias = "default-idp"

        # Get Keycloak config for URL construction
        # Default includes /auth for legacy Keycloak (pre-17) compatibility
        keycloak_public_url = os.getenv("KEYCLOAK_PUBLIC_URL", "http://localhost:8080/auth")
        keycloak_client_id = os.getenv("AUTH_KEYCLOAK_ID", "glow-client")

        # URL-encode return_url if provided (for use in query string)
        return_url_encoded = quote(request.return_url, safe="") if request.return_url else None

        # Convert API request to SQL params using double star pattern
        params = CreateEmulationGrantSqlParams(
            requester_profile_id=requester_profile_id,
            target_profile_id=request.target_profile_id,
            full_emulation=request.full_emulation,
            ttl_minutes=request.ttl_minutes,
            signin_base_url=signin_base_url,
            callback_url=callback_url,
            idp_alias=idp_alias,
            # New params for URL construction
            return_url=return_url_encoded,
            keycloak_public_url=keycloak_public_url,
            keycloak_client_id=keycloak_client_id,
            origin=origin,
            prefix=prefix,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            CreateEmulationGrantSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.allowed:
            raise HTTPException(status_code=403, detail=result.reason or "Forbidden")

        # Set audit context using actor_name from SQL result
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": requester_profile_id},
            )

        # Construct logout_url from emulate_page_url (Python handles URL encoding properly)
        logout_url = None
        if result.emulate_page_url:
            logout_url = (
                f"{keycloak_public_url}/realms/master/protocol/openid-connect/logout"
                f"?client_id={quote(keycloak_client_id, safe='')}"
                f"&post_logout_redirect_uri={quote(result.emulate_page_url, safe='')}"
            )

        # Convert SQL result to API response, adding the computed logout_url
        response_data = result.model_dump()
        response_data["logout_url"] = logout_url
        api_response = CreateEmulationGrantApiResponse.model_validate(response_data)

        # Invalidate cache after authorization check (may affect profile context)
        tags = ["profile"]  # From router tags
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="authorize_emulation",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
