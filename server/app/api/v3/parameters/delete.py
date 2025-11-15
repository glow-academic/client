"""Parameter delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


# Inline request/response schemas
class DeleteParameterRequest(BaseModel):
    """Request to delete parameter."""

    parameterId: str


class DeleteParameterResponse(BaseModel):
    """Response from delete parameter."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeleteParameterResponse)
async def delete_parameter(
    request: DeleteParameterRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteParameterResponse:
    """Delete a parameter if items not in use."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation
    
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    
    try:
        async with transaction(conn):
            # Delete parameter with usage check in single SQL (DHH style)
            sql_query = load_sql("sql/v3/parameters/delete_parameter_complete.sql")
            sql_params = (request.parameterId,)
            result = await conn.fetchrow(sql_query, request.parameterId)

            if not result:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            usage_count = result.get("usage_count", 0)
            if usage_count > 0:
                raise ValueError(
                    "Cannot delete parameter: Some items are in use by scenarios"
                )

            parameter_name = result.get("name")
            if not parameter_name:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            result_data = DeleteParameterResponse(
                success=True,
                message=f"Parameter '{parameter_name}' deleted successfully",
            )
            
            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)
            
            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_parameter",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

