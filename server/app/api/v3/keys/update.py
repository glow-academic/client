"""Keys update endpoint - v3 API following DHH principles."""

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
class UpdateKeyRequest(BaseModel):
    """Request to update key."""

    keyId: str
    name: str
    key: str  # Plain text key that will be encrypted
    description: str
    active: bool
    department_ids: list[str] | None = None
    profileId: str  # Required for auditing/access control


class UpdateKeyResponse(BaseModel):
    """Response from update key."""

    success: bool
    keyId: str
    key_masked: str  # Masked key for display
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateKeyResponse)
async def update_key(
    request: UpdateKeyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateKeyResponse:
    """Update an existing key."""
    tags = ["keys"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Encrypt the key before storing
            encrypted_key = encrypt_api_key(request.key)

            # Ensure department_ids is always an array (empty if None)
            department_ids = request.department_ids if request.department_ids else []

            # Update key with department links
            sql_query = load_sql("sql/v3/keys/update_key.sql")
            sql_params = (request.keyId, request.name, encrypted_key, request.description, request.active, department_ids, request.profileId)
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                raise HTTPException(
                    status_code=404, detail=f"Key not found: {request.keyId}"
                )

            key_id = result["key_id"]
            key_masked = result["key_masked"]

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UpdateKeyResponse(
            success=True,
            keyId=key_id,
            key_masked=key_masked,
            message="Key updated successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_key",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

