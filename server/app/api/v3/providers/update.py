"""Providers update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class UpdateProviderRequest(BaseModel):
    """Request to update provider."""

    providerId: str
    name: str
    description: str
    value: str
    active: bool
    base_url: str | None = None
    profileId: str  # Required for auditing/access control


class UpdateProviderResponse(BaseModel):
    """Response from update provider."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateProviderResponse)
async def update_provider(
    request: UpdateProviderRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateProviderResponse:
    """Update an existing provider."""
    tags = ["providers"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Update provider with optional endpoint
            sql_query = load_sql("sql/v3/providers/update_provider_complete.sql")
            sql_params = (
                request.providerId,
                request.name,
                request.description,
                request.value,
                request.active,
                request.base_url,
                request.profileId,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Provider not found: {request.providerId}"
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UpdateProviderResponse(
            success=True,
            message="Provider updated successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
