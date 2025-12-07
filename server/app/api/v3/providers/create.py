"""Providers create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreateProviderRequest(BaseModel):
    """Request to create provider."""

    name: str
    description: str
    value: str
    active: bool = True
    base_url: str | None = None
    profileId: str  # Required for auditing/access control


class CreateProviderResponse(BaseModel):
    """Response from create provider."""

    success: bool
    providerId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateProviderResponse)
async def create_provider(
    request: CreateProviderRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProviderResponse:
    """Create a new provider."""
    tags = ["providers"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Create provider with optional endpoint
            sql_query = load_sql("sql/v3/providers/create_provider_complete.sql")
            sql_params = (
                request.name,
                request.description,
                request.value,
                request.active,
                request.base_url,
                request.profileId,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to create provider")

            provider_id = result["provider_id"]

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateProviderResponse(
            success=True,
            providerId=provider_id,
            message="Provider created successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

