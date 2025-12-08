"""Field delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class DeleteFieldRequest(BaseModel):
    """Request to delete field."""

    fieldId: str
    profileId: str  # Required for auditing/access control


class DeleteFieldResponse(BaseModel):
    """Response from delete field."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteFieldResponse)
async def delete_field(
    request: DeleteFieldRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteFieldResponse:
    """Delete a field."""
    tags = ["fields"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            sql_query = load_sql("sql/v3/fields/delete_field_complete.sql")
            sql_params = (request.fieldId, request.profileId)
            result = await conn.fetchrow(sql_query, request.fieldId, request.profileId)

            if not result:
                raise ValueError(f"Field not found: {request.fieldId}")

            field_name = result.get("name")
            if not field_name:
                raise ValueError(f"Field not found: {request.fieldId}")

            result_data = DeleteFieldResponse(
                success=True,
                message=f"Field '{field_name}' deleted successfully",
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
