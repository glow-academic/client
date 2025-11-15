"""Provider duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateProviderResponse:
    """Duplicate a provider with all its models."""
    tags = ["providers"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Use the duplicate_provider.sql which handles everything in one query
            sql_query = load_sql("sql/v3/providers/duplicate_provider.sql")
            sql_params = (request.providerId,)
            try:
                result = await conn.fetchrow(sql_query, request.providerId)
            except Exception as sql_error:
                # If SQL fails (e.g., provider doesn't exist), return 400
                raise ValueError(
                    f"Provider not found: {request.providerId}"
                ) from sql_error

            if not result:
                raise ValueError(
                    f"Provider not found or failed to duplicate: {request.providerId}"
                )

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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
