"""Provider create endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.auth.encrypt_api_key import encrypt_api_key
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
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


@router.post("/create", response_model=CreateProviderResponse)
async def create_provider(
    request: CreateProviderRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateProviderResponse:
    """Create a new provider."""
    tags = ["providers"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Encrypt API key before storing
        encrypted_api_key = encrypt_api_key(request.api_key)

        # Create provider with endpoint in a single SQL file
        sql_query = load_sql("sql/v3/providers/create_provider_complete.sql")
        sql_params = (
            request.name,
            request.description,
            encrypted_api_key,
            request.base_url,
        )
        result = await conn.fetchrow(
            sql_query,
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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
