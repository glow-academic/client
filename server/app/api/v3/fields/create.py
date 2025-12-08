"""Field create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


class CreateFieldRequest(BaseModel):
    """Request to create field."""

    name: str
    description: str
    active: bool = True
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    parameter_ids: list[str] | None  # None = no parameters
    conditional_parameter_ids: list[str] | None = None  # Parameters to show when this field is selected
    profileId: str  # Required for auditing/access control


class CreateFieldResponse(BaseModel):
    """Response from create field."""

    success: bool
    fieldId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateFieldResponse)
async def create_field(
    request: CreateFieldRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateFieldResponse:
    """Create a new field with parameter and department associations."""
    tags = ["fields"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            sql_query = load_sql("sql/v3/fields/create_field_complete.sql")
            sql_params = (
                request.name,
                request.description,
                request.active,
                request.department_ids,
                request.parameter_ids,
                request.conditional_parameter_ids,
                request.profileId,
            )
            field_result = await conn.fetchrow(sql_query, *sql_params)

            if not field_result:
                raise ValueError("Failed to create field")

            field_id = field_result["field_id"]

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateFieldResponse(
            success=True,
            fieldId=field_id,
            message=f"Field '{request.name}' created successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_field",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

