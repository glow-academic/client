"""Provider create endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.utils.auth import encrypt_api_key
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


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


@router.post("/create", response_model=CreateProviderResponse)
async def create_provider(
    request: CreateProviderRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProviderResponse:
    """Create a new provider."""
    tags = ["providers"]  # From router tags
    
    try:
        # Encrypt API key before storing
        encrypted_api_key = encrypt_api_key(request.api_key)

        # Create provider with endpoint in a single SQL file
        sql = load_sql("sql/v3/providers/create_provider_complete.sql")
        result = await conn.fetchrow(
            sql,
            request.name,
            request.description,
            encrypted_api_key,
            request.base_url,
        )

        if not result:
            raise HTTPException(status_code=500, detail="Failed to create provider")

        provider_id = result["provider_id"]

        result_data = CreateProviderResponse(
            success=True,
            providerId=provider_id,
            message=f"Provider '{request.name}' created successfully",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

