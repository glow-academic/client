"""Parameter delete endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
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
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteParameterResponse:
    """Delete a parameter if items not in use."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation
    
    try:
        async with transaction(conn):
            # Delete parameter with usage check in single SQL (DHH style)
            delete_sql = load_sql("sql/v3/parameters/delete_parameter_complete.sql")
            result = await conn.fetchrow(delete_sql, request.parameterId)

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
        raise HTTPException(status_code=500, detail=str(e))

