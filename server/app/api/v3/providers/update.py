"""Provider update endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.auth import encrypt_api_key
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class UpdateProviderRequest(BaseModel):
    """Request to update provider.
    
    Note: Providers are global (not department-specific).
    """

    providerId: str
    name: str
    description: str
    api_key: str | None = None  # Optional - only update if provided
    base_url: str | None = None


class UpdateProviderResponse(BaseModel):
    """Response from update provider."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateProviderResponse)
async def update_provider(
    request: UpdateProviderRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateProviderResponse:
    """Update an existing provider."""
    tags = ["providers"]  # From router tags
    
    try:
        async with transaction(conn):
            # Check if provider exists
            get_name_sql = "SELECT name FROM providers WHERE id = $1"
            existing = await conn.fetchrow(get_name_sql, request.providerId)

            if not existing:
                raise ValueError(f"Provider not found: {request.providerId}")

            # Update provider basic fields
            update_sql = load_sql("sql/v3/providers/update_provider.sql")
            await conn.execute(
                update_sql,
                request.providerId,
                request.name,
                request.description,
            )

            # Upsert provider endpoint if base_url provided
            if request.base_url:
                endpoint_sql = load_sql("sql/v3/providers/upsert_provider_endpoint.sql")
                await conn.execute(endpoint_sql, request.providerId, request.base_url)

            # Update API key if provided (encrypt before storing)
            if request.api_key is not None:
                encrypted_api_key = encrypt_api_key(request.api_key)
                update_key_sql = load_sql("sql/v3/providers/update_provider_api_key.sql")
                await conn.execute(update_key_sql, request.providerId, encrypted_api_key)

            result_data = UpdateProviderResponse(
                success=True,
                message=f"Provider '{request.name}' updated successfully",
            )
            
            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)
            
            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

