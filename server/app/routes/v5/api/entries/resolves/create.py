"""Resolves entry CREATE endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.entries.resolves.types import (
    CreateResolvesEntryRequest,
    CreateResolvesEntryResponse,
)
from app.routes.v5.tools.entries.resolves.create import (
    create_resolve,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/resolves/create", response_model=CreateResolvesEntryResponse)
async def create_resolves_entry(
    request: CreateResolvesEntryRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateResolvesEntryResponse:
    """Create resolves entry."""
    tags = ["entries", "resolves"]
    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        mcp = getattr(http_request.state, "mcp", False) or False
        request_dict = request.model_dump()

        # API caller does not pass run_id — resolved internally
        if "run_id" not in request_dict or request_dict.get("run_id") is None:
            raise HTTPException(
                status_code=400,
                detail="run_id is required",
            )

        api_response = await create_resolve(conn, request_dict, mcp)

        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_resolves_entry",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
