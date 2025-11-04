"""Provider decrypt key endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.auth import decrypt_api_key
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
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
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DecryptProviderKeyResponse:
    """Decrypt provider API key for authorized users."""
    try:
        # Get provider detail to verify access and get encrypted key
        get_detail_sql = load_sql("sql/v3/providers/get_provider_detail_complete.sql")
        provider = await conn.fetchrow(get_detail_sql, request.providerId)

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
        raise HTTPException(status_code=500, detail=str(e))

