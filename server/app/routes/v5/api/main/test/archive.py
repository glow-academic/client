"""Benchmark test archive endpoint."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.test.types import ArchiveTestsRequest, ArchiveTestsResponse
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import load_sql

SQL_PATH = "app/sql/queries/benchmark/archive_test.sql"

router = APIRouter()


@router.post("/archive", response_model=ArchiveTestsResponse)
async def archive_test_artifacts(
    request: ArchiveTestsRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ArchiveTestsResponse:
    """Archive or unarchive benchmark tests by IDs."""
    tags = ["benchmark", "test", "artifacts"]

    try:
        sql = load_sql(SQL_PATH)
        row = await conn.fetchrow(sql, request.test_ids, request.archived)
        if row is None:
            raise HTTPException(status_code=500, detail="Failed to archive tests")

        updated_count = int(row["updated_count"] or 0)

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return ArchiveTestsResponse(updated_count=updated_count)
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_test_archive",
            request=http_request,
        )
