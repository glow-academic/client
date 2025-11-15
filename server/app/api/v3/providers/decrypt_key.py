"""Provider decrypt key endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.auth.decrypt_api_key import decrypt_api_key
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel


# Inline request/response schemas
class DecryptProviderKeyRequest(BaseModel):
    """Request to decrypt provider API key."""

    providerId: str
    profileId: str


class DecryptProviderKeyResponse(BaseModel):
    """Response with decrypted API key."""

    api_key: str


router = APIRouter()


@router.post("/decrypt-key", response_model=DecryptProviderKeyResponse)
async def decrypt_provider_key(
    request: DecryptProviderKeyRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DecryptProviderKeyResponse:
    """Decrypt provider API key for authorized users."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get provider detail to verify access and get encrypted key
        sql_query = load_sql("sql/v3/providers/get_provider_detail_complete.sql")
        sql_params = (request.providerId,)
        provider = await conn.fetchrow(sql_query, request.providerId)

        if not provider:
            raise ValueError(f"Provider not found: {request.providerId}")

        # Decrypt the API key
        encrypted_key = provider["api_key"]
        if not encrypted_key:
            raise ValueError("API key is missing - provider has no API key set")

        decrypted_key = decrypt_api_key(encrypted_key)

        return DecryptProviderKeyResponse(api_key=decrypted_key)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="decrypt_provider_key",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
