"""Test entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.test.get import get_tests
from app.sql.types import (
    GetTestEntriesApiRequest,
    GetTestEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/test/get",
    response_model=GetTestEntriesApiResponse,
)
async def get_test_entries(
    request: GetTestEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestEntriesApiResponse:
    """Get test entries by IDs."""
    tags = ["entries", "test"]

    try:
        items = await get_tests(conn, request.ids)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestEntriesApiResponse(
            items=[item.model_dump(mode="json") for item in items]
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_test_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
