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
            # Check if any parameter items are in use
            check_usage_sql = load_sql("sql/v3/parameters/check_parameter_usage.sql")
            usage = await conn.fetchrow(check_usage_sql, request.parameterId)

            if not usage:
                raise ValueError("Failed to check parameter usage")

            usage_count = usage.get("usage_count", 0)
            if usage_count > 0:
                raise ValueError(
                    "Cannot delete parameter: Some items are in use by scenarios"
                )

            # Get parameter name
            get_name_sql = "SELECT name FROM parameters WHERE id = $1"
            parameter = await conn.fetchrow(get_name_sql, request.parameterId)

            if not parameter:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            # Delete parameter (cascade deletes items)
            delete_sql = load_sql("sql/v3/parameters/delete_parameter.sql")
            await conn.execute(delete_sql, request.parameterId)

            result_data = DeleteParameterResponse(
                success=True,
                message=f"Parameter '{parameter['name']}' deleted successfully",
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

