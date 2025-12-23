"""Providers delete endpoint - v3 API following DHH principles."""

import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


# Inline request/response schemas
class DeleteProviderRequest(BaseModel):
    """Request to delete provider."""

    providerId: str
    # profileId removed - comes from X-Profile-Id header


class DeleteProviderResponse(BaseModel):
    """Response from delete provider."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteProviderResponse,
    dependencies=[
        audit_activity(
            "provider.deleted",
            "{{ actor.name }} deleted provider '{{ provider.name }}'",
        )
    ],
)
async def delete_provider(
    request: DeleteProviderRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteProviderResponse:
    """Delete a provider (prevents deletion if used by models)."""
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
            # Check if provider exists and can be deleted
            sql_query = load_sql("app/sql/v3/providers/delete_provider.sql")
            sql_params = (uuid.UUID(request.providerId), profile_id)
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                # Check if provider exists
                provider_exists = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM providers WHERE id = $1)",
                    uuid.UUID(request.providerId),
                )
                if provider_exists:
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot delete provider: it is being used by one or more models",
                    )
                raise HTTPException(
                    status_code=404, detail=f"Provider not found: {request.providerId}"
                )

            # Set audit context with data from SQL query
            provider_name = result.get("name")
            actor_name = result.get("actor_name")
            if actor_name and provider_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    provider={"name": provider_name, "id": request.providerId},
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return DeleteProviderResponse(
            success=True,
            message="Provider deleted successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_provider",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
