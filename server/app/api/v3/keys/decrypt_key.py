"""Keys decrypt endpoint - decrypt encrypted key value."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DecryptKeyRequest(BaseModel):
    """Request to decrypt key."""

    keyId: str
    profileId: str


class DecryptKeyResponse(BaseModel):
    """Response from decrypt key."""

    key: str  # Decrypted key value


router = APIRouter()


@router.post("/decrypt-key", response_model=DecryptKeyResponse)
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
        # Fetch the encrypted key from database
        sql_query = load_sql("sql/v3/keys/get_key_detail.sql")
        sql_params = (request.keyId, True)  # show_full=True to get encrypted key
        result = await conn.fetchrow(sql_query, request.keyId, True)

        if not result:
            raise HTTPException(
                status_code=400, detail=f"Key not found: {request.keyId}"
            )

        # Get the encrypted key value
        encrypted_key = result["key"]

        # Decrypt the key
        try:
            decrypted_key = decrypt_api_key(encrypted_key)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

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
