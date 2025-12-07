"""Auth create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.auth.encrypt_api_key import encrypt_api_key
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class AuthItemCreate(BaseModel):
    """Auth item creation schema."""

    name: str
    description: str
    value: str | None = None  # Plain text value for non-encrypted items
    key_id: str | None = None  # Key ID for encrypted items
    encrypted: bool = True  # Default to encrypted for backward compatibility


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
                if item.encrypted:
                    # For encrypted items, use key_id (value is ignored)
                    item_dict = {
                        "name": item.name,
                        "description": item.description,
                        "encrypted": True,
                        "key_id": item.key_id if hasattr(item, 'key_id') and item.key_id else None,
                    }
                else:
                    # For non-encrypted items, use value (key_id is ignored)
                    item_dict = {
                        "name": item.name,
                        "description": item.description,
                        "encrypted": False,
                        "value": item.value,
                    }
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

