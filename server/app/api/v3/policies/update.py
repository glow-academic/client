"""Policy update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class UpdatePolicyRequest(BaseModel):
    """Request to update a policy."""

    policyId: str
    name: str
    description: str
    file_path: str
    mime_type: str
    active: bool


class UpdatePolicyResponse(BaseModel):
    """Response from update operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdatePolicyResponse)
async def update_policy(
    request: UpdatePolicyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdatePolicyResponse:
    """Update an existing policy."""
    tags = ["policies"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Update policy in a single SQL file
        sql_query = load_sql("sql/v3/policies/update_policy_complete.sql")
        sql_params = (
            request.policyId,
            request.name,
            request.description,
            request.file_path,
            request.mime_type,
            request.active,
        )
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Policy not found: {request.policyId}"
            )

        result_data = UpdatePolicyResponse(
            success=True,
            message=f"Policy '{result['name']}' updated successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="update_policy",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

