"""Parameter item create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreateParameterItemRequest(BaseModel):
    """Request to create a single parameter item."""

    parameterId: str
    name: str
    description: str
    value: str


class CreateParameterItemResponse(BaseModel):
    """Response from create parameter item."""

    success: bool
    parameterItemId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateParameterItemResponse)
async def create_parameter_item(
    request: CreateParameterItemRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateParameterItemResponse:
    """Create a single parameter item (for inline creation from pickers)."""
    tags = ["parameters", "agents"]  # Parameter items used in scenario context

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Verify parameter exists
            check_sql = "SELECT name FROM parameters WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.parameterId)

            if not existing:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            # Create parameter item (track primary operation)
            sql_query = load_sql("sql/v3/parameters/create_parameter_item.sql")
            sql_params = (
                request.parameterId,
                request.name,
                request.description,
                request.value,
            )
            item_result = await conn.fetchrow(sql_query, *sql_params)

            if not item_result:
                raise ValueError("Failed to create parameter item")

            parameter_item_id = str(item_result["id"])

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateParameterItemResponse(
            success=True,
            parameterItemId=parameter_item_id,
            message=f"Parameter item '{request.name}' created successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_parameter_item",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
