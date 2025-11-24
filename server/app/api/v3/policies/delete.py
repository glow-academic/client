"""Policy delete endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class DeletePolicyRequest(BaseModel):
    """Request to delete a policy."""

    policyId: str


class DeletePolicyResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str


router = APIRouter()


@router.post("/delete", response_model=DeletePolicyResponse)
async def delete_policy(
    request: DeletePolicyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeletePolicyResponse:
    """Delete a policy (soft delete)."""
    tags = ["policies"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Delete policy (soft delete) in a single SQL file
        sql_query = load_sql("sql/v3/policies/delete_policy.sql")
        sql_params = (request.policyId,)
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise HTTPException(
                status_code=404, detail=f"Policy not found: {request.policyId}"
            )

        result_data = DeletePolicyResponse(
            success=True,
            message=f"Policy deleted successfully",
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
            operation="delete_policy",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

