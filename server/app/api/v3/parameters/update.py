"""Parameter update endpoint - v3 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db, transaction
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel


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

            # Prepare items as JSONB array
            import json
            items_data = []
            for item in request.parameter_items:
                item_dict = {
                    "name": item.name,
                    "description": item.description,
                    "value": item.value,
                }
                # Only include department_ids if it's not None
                if item.department_ids is not None:
                    item_dict["department_ids"] = item.department_ids  # type: ignore
                items_data.append(item_dict)
            
            items_json = json.dumps(items_data)

            # Update parameter with items and department links in single SQL (DHH style)
            update_sql = load_sql("sql/v3/parameters/update_parameter_complete.sql")
            result = await conn.fetchrow(
                update_sql,
                request.parameterId,
                request.name,
                request.description,
                request.numerical,
                request.active,
                request.document_parameter,
                request.practice_parameter,
                request.department_ids,  # Parameter-level department_ids (fallback)
                items_json,  # JSONB array of items
            )

            if not result:
                raise ValueError("Failed to update parameter")

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

