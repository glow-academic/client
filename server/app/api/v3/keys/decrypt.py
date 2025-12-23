"""Keys decrypt endpoint - decrypt encrypted key value."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.auth.decrypt_api_key import decrypt_api_key
from utils.sql_helper import load_sql


# Inline request/response schemas
class DecryptKeyRequest(BaseModel):
    """Request to decrypt key."""

    keyId: str
    # profileId removed - comes from X-Profile-Id header


class DecryptKeyResponse(BaseModel):
    """Response from decrypt key."""

    key: str  # Decrypted key value


router = APIRouter()


@router.post(
    "/decrypt",
    response_model=DecryptKeyResponse,
    dependencies=[
        audit_activity(
            "key.decrypted", "{{ actor.name }} decrypted key '{{ key.name }}'"
        )
    ],
)
async def decrypt_key(
    request: DecryptKeyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DecryptKeyResponse:
    """Decrypt a key's encrypted value."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch the encrypted key from database
        sql_query = load_sql("app/sql/v3/keys/get_key_detail.sql")
        sql_params = (
            request.keyId,
            True,
            profile_id,
        )  # show_full=True to get encrypted key
        result = await conn.fetchrow(sql_query, request.keyId, True, profile_id)

        if not result:
            raise HTTPException(
                status_code=400, detail=f"Key not found: {request.keyId}"
            )

        # Get the encrypted key value
        encrypted_key = result["key"]
        key_name = result.get("name")
        actor_name = result.get("actor_name")

        # Decrypt the key
        try:
            decrypted_key = decrypt_api_key(encrypted_key)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

        # Set audit context
        if actor_name and key_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                key={"name": key_name, "id": request.keyId},
            )

        return DecryptKeyResponse(key=decrypted_key)
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="decrypt_key",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
