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
            # Get original parameter data
            get_parameter_sql = """
                SELECT name, description, numerical, 
                       COALESCE(document_parameter, false) as document_parameter,
                       COALESCE(practice_parameter, false) as practice_parameter
                FROM parameters
                WHERE id = $1
            """
            parameter = await conn.fetchrow(get_parameter_sql, request.parameterId)

            if not parameter:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            # Create duplicate parameter
            duplicate_sql = load_sql("sql/v3/parameters/duplicate_parameter.sql")
            new_parameter = await conn.fetchrow(
                duplicate_sql,
                parameter["name"],
                parameter["description"],
                parameter["numerical"],
                parameter["document_parameter"],
                parameter["practice_parameter"],
            )

            if not new_parameter:
                raise ValueError("Failed to create duplicate parameter")

            new_parameter_id = str(new_parameter["id"])

            # Get original items
            get_items_sql = load_sql("sql/v3/parameters/get_items_for_duplicate.sql")
            items = await conn.fetch(get_items_sql, request.parameterId)

            # Get department_ids for each item and duplicate them
            item_dept_query = """
                SELECT pid.department_id::text
                FROM parameter_item_departments pid
                WHERE pid.parameter_item_id = $1::uuid AND pid.active = true
            """

            # Duplicate items with their department associations
            item_sql = load_sql("sql/v3/parameters/create_parameter_item.sql")
            for item in items:
                item_result = await conn.fetchrow(
                    item_sql,
                    new_parameter_id,
                    item["name"],
                    item["description"],
                    item["value"],
                )
                if item_result:
                    new_item_id = str(item_result["id"])
                    # Get original item's department_ids
                    original_item_id = str(item["id"])
                    dept_results = await conn.fetch(item_dept_query, original_item_id)
                    if dept_results:
                        dept_ids = [str(d["department_id"]) for d in dept_results]
                        if dept_ids:
                            insert_dept_sql = load_sql("sql/v3/parameters/create_parameter_item_departments.sql")
                            await conn.execute(insert_dept_sql, new_item_id, dept_ids)

            result_data = DuplicateParameterResponse(
                success=True,
                parameterId=new_parameter_id,
                message=f"Parameter '{parameter['name']}' duplicated successfully",
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

