"""Auth create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class AuthItemCreate(BaseModel):
    """Auth item creation schema."""

    name: str
    description: str
    key_ids: list[str] | None = None  # Optional list of key IDs


class CreateAuthRequest(BaseModel):
    """Request to create auth with nested items."""

    name: str
    description: str
    active: bool
    auth_items: list[AuthItemCreate]


class CreateAuthResponse(BaseModel):
    """Response from create auth."""

    success: bool
    authId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateAuthResponse)
async def create_auth(
    request: CreateAuthRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateAuthResponse:
    """Create a new auth entry with nested items."""
    tags = ["auth"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Prepare items as JSONB array
            import json

            items_data = []
            for item in request.auth_items:
                item_dict = {
                    "name": item.name,
                    "description": item.description,
                }
                # Only include key_ids if it's not None
                if item.key_ids is not None:
                    item_dict["key_ids"] = item.key_ids  # type: ignore
                items_data.append(item_dict)

            items_json = json.dumps(items_data)

            # Create auth with items and key links in single SQL (DHH style)
            sql_query = load_sql("sql/v3/auth/create_auth_complete.sql")
            sql_params = (
                request.name,
                request.description,
                request.active,
                items_json,  # JSONB array of items
            )
            auth_result = await conn.fetchrow(sql_query, *sql_params)

            if not auth_result:
                raise ValueError("Failed to create auth")

            auth_id = auth_result["auth_id"]

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateAuthResponse(
            success=True,
            authId=auth_id,
            message=f"Auth '{request.name}' created successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_auth",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

