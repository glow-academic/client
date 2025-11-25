"""Settings update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class UpdateSettingsRequest(BaseModel):
    """Request to update settings."""

    color: str
    organization_name: str
    profileId: str  # Required for auditing/access control


class UpdateSettingsResponse(BaseModel):
    """Response from update settings."""

    success: bool
    message: str
    settings_id: str


router = APIRouter()


@router.post("/update", response_model=UpdateSettingsResponse)
async def update_settings(
    request: UpdateSettingsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateSettingsResponse:
    """Update settings (creates new active row, deactivates old)."""
    tags = ["settings"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Update settings: deactivate current active, insert new active row
            sql_query = load_sql("sql/v3/settings/update_settings.sql")
            sql_params = (
                request.color,
                request.organization_name,
                request.profileId,
            )
            result = await conn.fetchrow(
                sql_query,
                request.color,
                request.organization_name,
                request.profileId,
            )

            if not result:
                raise HTTPException(
                    status_code=500, detail="Failed to update settings"
                )

            settings_id = result["settings_id"]

            result_data = UpdateSettingsResponse(
                success=True,
                message="Settings updated successfully",
                settings_id=settings_id,
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
            operation="update_settings",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

