"""Provider create endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.auth import encrypt_api_key
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class CreateProviderRequest(BaseModel):
    name: str
    description: str
    api_key: str
    base_url: str | None = None


class CreateProviderResponse(BaseModel):
    success: bool
    providerId: str
    message: str


router = APIRouter()


@router.post("/create")
async def create_provider(
    request: CreateProviderRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProviderResponse:
    """Create a new provider."""
    try:
        # Encrypt API key before storing
        encrypted_api_key = encrypt_api_key(request.api_key)

        create_sql = load_sql("sql/v3/providers/create_provider.sql")
        result = await conn.fetchrow(
            create_sql,
            request.name,
            request.description,
            encrypted_api_key,
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create provider")

        provider_id = str(result["id"])

        # Insert provider endpoint if base_url provided
        if request.base_url:
            endpoint_sql = load_sql("sql/v3/providers/upsert_provider_endpoint.sql")
            await conn.execute(endpoint_sql, provider_id, request.base_url)

        return CreateProviderResponse(
            success=True,
            providerId=provider_id,
            message=f"Provider '{request.name}' created successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

