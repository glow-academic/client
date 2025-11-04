"""Provider duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class DuplicateProviderRequest(BaseModel):
    """Request to duplicate provider."""

    providerId: str


class DuplicateProviderResponse(BaseModel):
    """Response from duplicate provider."""

    success: bool
    providerId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateProviderResponse)
async def duplicate_provider(
    request: DuplicateProviderRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateProviderResponse:
    """Duplicate a provider with all its models."""
    tags = ["providers"]  # From router tags
    
    try:
        async with transaction(conn):
            # Use the duplicate_provider.sql which handles everything in one query
            duplicate_sql = load_sql("sql/v3/providers/duplicate_provider.sql")
            result = await conn.fetchrow(duplicate_sql, request.providerId)

            if not result:
                raise ValueError(f"Provider not found or failed to duplicate: {request.providerId}")

            new_provider_id = str(result["provider_id"])

            result_data = DuplicateProviderResponse(
                success=True,
                providerId=new_provider_id,
                message="Provider duplicated successfully",
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

