"""Policy create endpoint - v3 API following DHH principles."""

from typing import Annotated, Any
import uuid

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class CreatePolicyRequest(BaseModel):
    """Request to create a policy."""

    name: str
    description: str
    file_path: str
    mime_type: str


class CreatePolicyResponse(BaseModel):
    """Response from create operation."""

    success: bool
    policyId: str
    message: str


router = APIRouter()


@router.post("/create", response_model=CreatePolicyResponse)
async def create_policy(
    request: CreatePolicyRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreatePolicyResponse:
    """Create a new policy."""
    tags = ["policies"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        policy_id = uuid.uuid4()

        # Create policy in a single SQL file
        sql_query = load_sql("sql/v3/policies/insert_policy_complete.sql")
        sql_params = (
            policy_id,
            request.name,
            request.description,
            request.file_path,
            request.mime_type,
        )
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise ValueError("Failed to create policy")

        policy_id_str = result["policy_id"]

        result_data = CreatePolicyResponse(
            success=True,
            policyId=policy_id_str,
            message=f"Policy '{request.name}' created successfully",
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
            operation="create_policy",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )

