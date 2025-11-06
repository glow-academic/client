"""Provider delete endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class DeleteProviderRequest(BaseModel):
    """Request to delete provider."""

    providerId: str


class DeleteProviderResponse(BaseModel):
    """Response from delete provider."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteProviderResponse)
async def delete_provider(
    request: DeleteProviderRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteProviderResponse:
    """Delete a provider if no models are in use."""
    tags = ["providers"]  # From router tags
    
    try:
        # Delete provider with existence and usage checks in a single SQL file
        sql = load_sql("sql/v3/providers/delete_provider_complete.sql")
        result = await conn.fetchrow(sql, request.providerId)

        if not result:
            # Provider doesn't exist
            raise ValueError(f"Provider not found: {request.providerId}")

        # Check if provider was deleted or is in use
        if not result["deleted"]:
            # Provider exists but is in use
            total_usage = result["total_usage"]
            if result["persona_usage_count"] > 0:
                raise ValueError(
                    f"Cannot delete provider: Some models are in use by {result['persona_usage_count']} persona(s)"
                )
            if result["agent_usage_count"] > 0:
                raise ValueError(
                    f"Cannot delete provider: Some models are in use by {result['agent_usage_count']} agent(s)"
                )
            raise ValueError(
                f"Cannot delete provider: in use by {total_usage} entities"
            )

        provider_name = result["name"]

        result_data = DeleteProviderResponse(
            success=True,
            message=f"Provider '{provider_name}' deleted successfully",
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

