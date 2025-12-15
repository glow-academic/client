"""Auth update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class AuthItemUpdate(BaseModel):
    """Auth item update schema."""

    name: str
    description: str
    value: str | None = None  # Plain text value for non-encrypted items
    key_id: str | None = None  # Key ID for encrypted items
    encrypted: bool = True  # Default to encrypted for backward compatibility
    position: int | None = None  # Position in the list (defaults to array order)
    active: bool = True  # Whether this item is active


class UpdateAuthRequest(BaseModel):
    """Request to update auth with nested items."""

    authId: str
    name: str
    description: str
    active: bool
    auth_items: list[AuthItemUpdate]
    profileId: str


class UpdateAuthResponse(BaseModel):
    """Response from update auth."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateAuthResponse)
async def update_auth(
    request: UpdateAuthRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateAuthResponse:
    """Update an existing auth entry (replace all items)."""
    tags = ["auth"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Check if auth exists
            check_sql = "SELECT name FROM auth WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.authId)

            if not existing:
                raise ValueError(f"Auth not found: {request.authId}")

            # Prepare items as JSONB array
            import json

            items_data = []
            for item in request.auth_items:
                # Values are managed separately in settings, not included here
                item_dict = {
                    "name": item.name,
                    "description": item.description,
                    "encrypted": item.encrypted,
                    "position": item.position,
                    "active": item.active,
                }
                # Only include key_id for encrypted items if provided
                if item.encrypted and hasattr(item, "key_id") and item.key_id:
                    item_dict["key_id"] = item.key_id
                items_data.append(item_dict)

            items_json = json.dumps(items_data)

            # Update auth with items and key links in single SQL (DHH style)
            sql_query = load_sql("sql/v3/auth/update_auth_complete.sql")
            sql_params = (
                request.authId,
                request.name,
                request.description,
                request.active,
                items_json,  # JSONB array of items
            )
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise ValueError("Failed to update auth")

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UpdateAuthResponse(
            success=True, message=f"Auth '{request.name}' updated successfully"
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
