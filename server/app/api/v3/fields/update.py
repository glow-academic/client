"""Field update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class UpdateFieldRequest(BaseModel):
    """Request to update field."""

    fieldId: str
    name: str
    description: str
    active: bool = True
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    conditional_parameter_ids: list[str] | None = (
        None  # Parameters to show when this field is selected
    )
    profileId: str  # Required for auditing/access control


class UpdateFieldResponse(BaseModel):
    """Response from update field."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateFieldResponse)
async def update_field(
    request: UpdateFieldRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateFieldResponse:
    """Update an existing field."""
    tags = ["fields"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Check if field exists
            check_sql = "SELECT name FROM fields WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.fieldId)

            if not existing:
                raise ValueError(f"Field not found: {request.fieldId}")

            sql_query = load_sql("sql/v3/fields/update_field_complete.sql")
            sql_params = (
                request.fieldId,
                request.name,
                request.description,
                request.active,
                request.department_ids,
                request.conditional_parameter_ids,
                request.profileId,
            )
            await conn.fetchrow(sql_query, *sql_params)

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UpdateFieldResponse(
            success=True,
            message=f"Field '{request.name}' updated successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
