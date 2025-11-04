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
        async with transaction(conn):
            # Get provider name
            get_name_sql = "SELECT name FROM providers WHERE id = $1"
            provider = await conn.fetchrow(get_name_sql, request.providerId)

            if not provider:
                raise ValueError(f"Provider not found: {request.providerId}")

            # Get all models for this provider
            get_models_sql = load_sql("sql/v3/providers/get_provider_models.sql")
            models = await conn.fetch(get_models_sql, request.providerId)
            model_ids = [m["id"] for m in models]  # Keep as UUID objects

            # Check if any models are in use
            if model_ids:
                # Check personas (check all models at once)
                check_personas_sql = """
                    SELECT model_id, COUNT(*) as usage_count
                    FROM personas
                    WHERE model_id = ANY($1::uuid[])
                    GROUP BY model_id
                """
                personas_usage = await conn.fetch(check_personas_sql, model_ids)
                if personas_usage:
                    raise ValueError(
                        "Cannot delete provider: Some models are in use by personas"
                    )

                # Check agents (check all models at once)
                check_agents_sql = """
                    SELECT model_id, COUNT(*) as usage_count
                    FROM agents
                    WHERE model_id = ANY($1::uuid[])
                    GROUP BY model_id
                """
                agents_usage = await conn.fetch(check_agents_sql, model_ids)
                if agents_usage:
                    raise ValueError(
                        "Cannot delete provider: Some models are in use by agents"
                    )

            # Delete provider (cascade deletes models)
            delete_sql = load_sql("sql/v3/providers/delete_provider.sql")
            await conn.execute(delete_sql, request.providerId)

            result_data = DeleteProviderResponse(
                success=True,
                message=f"Provider '{provider['name']}' deleted successfully",
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

