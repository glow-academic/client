"""Providers create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline request/response schemas
class CreateProviderRequest(BaseModel):
    """Request to create provider."""

    name: str
    description: str
    value: str
    active: bool = True
    base_url: str | None = None
    # profileId removed - comes from X-Profile-Id header


class CreateProviderResponse(BaseModel):
    """Response from create provider."""

    success: bool
    providerId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateProviderResponse,
    dependencies=[
        audit_activity(
            "provider.created",
            "{{ actor.name }} created provider '{{ provider.name }}'",
        )
    ],
)
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
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Create provider with optional endpoint
            sql_query = load_sql("app/sql/v3/providers/create_provider_complete.sql")
            sql_params = (
                request.name,
                request.description,
                request.value,
                request.active,
                request.base_url,
                profile_id,
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to create provider")

            provider_id = result["provider_id"]
            actor_name = result.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    provider={"name": request.name, "id": provider_id},
                )

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
