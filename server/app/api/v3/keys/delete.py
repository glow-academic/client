"""Keys delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.infra.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeleteKeyRequest(BaseModel):
    """Request to delete key."""

    keyId: str
    # profileId removed - comes from X-Profile-Id header


class DeleteKeyResponse(BaseModel):
    """Response from delete key."""

    success: bool
    message: str


router = APIRouter()


@router.post(
    "/delete",
    response_model=DeleteKeyResponse,
    dependencies=[
        audit_activity("key.deleted", "{{ actor.name }} deleted key '{{ key.name }}'")
    ],
)
async def delete_key(
    request: DeleteKeyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteKeyResponse:
    """Delete a key with permission checks."""
    tags = ["keys"]

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
            # Delete key with permission checks (cascade deletes department_keys)
            sql_query = load_sql("sql/v3/keys/delete_key.sql")
            sql_params = (request.keyId, profile_id)
            result = await conn.fetchrow(sql_query, *sql_params)

            if not result:
                # Check if key exists but user doesn't have permission
                key_exists_check = await conn.fetchval(
                    "SELECT EXISTS(SELECT 1 FROM keys WHERE id = $1::uuid)",
                    request.keyId,
                )
                if key_exists_check:
                    raise HTTPException(
                        status_code=403,
                        detail="You don't have permission to delete this key. It may be restricted to other departments.",
                    )
                raise HTTPException(
                    status_code=404, detail=f"Key not found: {request.keyId}"
                )

            # Set audit context with data from SQL query
            key_name = result.get("name")
            actor_name = result.get("actor_name")
            if actor_name and key_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    key={"name": key_name, "id": request.keyId},
                )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return DeleteKeyResponse(
            success=True,
            message="Key deleted successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_key",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
