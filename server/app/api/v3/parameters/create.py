"""Parameter create endpoint - v3 API following DHH principles."""

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


class CreateParameterRequest(BaseModel):
    """Request to create parameter with nested items."""

    name: str
    description: str
    numerical: bool
    active: bool
    document_parameter: bool = False
    practice_parameter: bool = False
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    parameter_items: list[ParameterItemCreate]


class CreateParameterResponse(BaseModel):
    """Response from create parameter."""

    success: bool
    parameterId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreateParameterResponse)
async def create_parameter(
    request: CreateParameterRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateParameterResponse:
    """Create a new parameter with nested items."""
    tags = ["parameters", "agents"]  # Parameters used in scenario generation
    
    try:
        async with transaction(conn):
            # Create parameter
            create_sql = load_sql("sql/v3/parameters/create_parameter.sql")
            parameter_result = await conn.fetchrow(
                create_sql,
                request.name,
                request.description,
                request.numerical,
                request.active,
                request.document_parameter,
                request.practice_parameter,
            )

            if not parameter_result:
                raise ValueError("Failed to create parameter")

            parameter_id = str(parameter_result["id"])

            # Create parameter items
            item_sql = load_sql("sql/v3/parameters/create_parameter_item.sql")
            item_ids = []
            for item in request.parameter_items:
                item_result = await conn.fetchrow(
                    item_sql,
                    parameter_id,
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

        return CreateParameterResponse(
            success=True,
            parameterId=parameter_id,
            message=f"Parameter '{request.name}' created successfully",
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

