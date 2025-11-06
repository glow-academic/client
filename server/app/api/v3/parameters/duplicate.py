"""Parameter duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


# Inline request/response schemas
class DuplicateParameterRequest(BaseModel):
    """Request to duplicate parameter."""

    parameterId: str


class DuplicateParameterResponse(BaseModel):
    """Response from duplicate parameter."""

    success: bool
    parameterId: str
    message: str


router = APIRouter()


@router.post("/duplicate", response_model=DuplicateParameterResponse)
async def duplicate_parameter(
    request: DuplicateParameterRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateParameterResponse:
    """Duplicate a parameter with all items and their department associations."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation
    
    try:
        async with transaction(conn):
            # Duplicate parameter with items and department links in single SQL (DHH style)
            duplicate_sql = load_sql("sql/v3/parameters/duplicate_parameter_complete.sql")
            new_parameter = await conn.fetchrow(duplicate_sql, request.parameterId)

            if not new_parameter:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            new_parameter_id = new_parameter["parameter_id"]

            # Get original parameter name for message
            original_parameter = await conn.fetchrow(
                "SELECT name FROM parameters WHERE id = $1", request.parameterId
            )

            result_data = DuplicateParameterResponse(
                success=True,
                parameterId=new_parameter_id,
                message=f"Parameter '{original_parameter['name']}' duplicated successfully",
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

