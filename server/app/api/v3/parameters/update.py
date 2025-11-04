"""Parameter update endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class ParameterItemCreate(BaseModel):
    """Parameter item creation schema."""

    name: str
    description: str
    value: str
    department_ids: list[str] | None = None  # Optional for backward compatibility


class UpdateParameterRequest(BaseModel):
    """Request to update parameter with nested items."""

    parameterId: str
    name: str
    description: str
    numerical: bool
    active: bool
    document_parameter: bool
    practice_parameter: bool
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    parameter_items: list[ParameterItemCreate]


class UpdateParameterResponse(BaseModel):
    """Response from update parameter."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateParameterResponse)
async def update_parameter(
    request: UpdateParameterRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateParameterResponse:
    """Update an existing parameter (replace all items)."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation
    
    try:
        async with transaction(conn):
            # Check if parameter exists
            check_sql = "SELECT name FROM parameters WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.parameterId)

            if not existing:
                raise ValueError(f"Parameter not found: {request.parameterId}")

            # Update parameter basic fields
            update_sql = load_sql("sql/v3/parameters/update_parameter.sql")
            await conn.execute(
                update_sql,
                request.parameterId,
                request.name,
                request.description,
                request.numerical,
                request.active,
                request.document_parameter,
                request.practice_parameter,
            )

            # Delete existing parameter items (this will cascade delete parameter_item_departments)
            delete_items_sql = load_sql("sql/v3/parameters/delete_parameter_items.sql")
            await conn.execute(delete_items_sql, request.parameterId)

            # Recreate parameter items
            item_sql = load_sql("sql/v3/parameters/create_parameter_item.sql")
            item_ids = []
            for item in request.parameter_items:
                item_result = await conn.fetchrow(
                    item_sql,
                    request.parameterId,
                    item.name,
                    item.description,
                    item.value,
                )
                if item_result:
                    item_id = str(item_result["id"])
                    item_ids.append(item_id)

                    # Link department_ids to this parameter item if provided
                    # Use per-item department_ids if available, otherwise fall back to parameter-level
                    dept_ids = (
                        item.department_ids
                        if item.department_ids is not None
                        else request.department_ids
                    )
                    if dept_ids:
                        dept_sql = load_sql(
                            "sql/v3/parameters/create_parameter_item_departments.sql"
                        )
                        await conn.execute(dept_sql, item_id, dept_ids)

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return UpdateParameterResponse(
            success=True, message=f"Parameter '{request.name}' updated successfully"
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

