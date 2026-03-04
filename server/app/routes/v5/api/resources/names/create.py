"""Names CREATE endpoint — v5 API."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.types import (
    CreateNameRequest,
    CreateNameResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/names", response_model=CreateNameResponse)
async def create_names_endpoint(
    request: CreateNameRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateNameResponse:
    """Create names resource (always INSERT)."""
    tags = ["resources", "names"]

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        mcp = getattr(http_request.state, "mcp", False) or False

        async with conn.transaction():
            result = await create_name(conn, name=request.name, mcp=mcp)

        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_names",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
