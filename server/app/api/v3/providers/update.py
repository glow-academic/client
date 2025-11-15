"""Provider update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.auth import encrypt_api_key
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateProviderResponse:
    """Update an existing provider."""
    tags = ["providers"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Encrypt API key if provided
        encrypted_api_key = None
        if request.api_key is not None:
            encrypted_api_key = encrypt_api_key(request.api_key)

        # Update provider with endpoint and API key in a single SQL file
        sql_query = load_sql("sql/v3/providers/update_provider_complete.sql")
        sql_params = (
            request.providerId,
            request.name,
            request.description,
            encrypted_api_key,
            request.base_url,
        )
        result = await conn.fetchrow(
            sql_query,
            request.providerId,
            request.name,
            request.description,
            encrypted_api_key,
            request.base_url,
        )

        if not result:
            raise ValueError(f"Provider not found: {request.providerId}")

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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
