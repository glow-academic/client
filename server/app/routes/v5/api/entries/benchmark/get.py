"""Benchmark entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.benchmark.get import get_benchmarks
from app.sql.types import (
    GetBenchmarkEntriesApiRequest,
    GetBenchmarkEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/benchmark/get",
    response_model=GetBenchmarkEntriesApiResponse,
)
async def get_benchmark_entries(
    request: GetBenchmarkEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetBenchmarkEntriesApiResponse:
    """Get benchmark entries by IDs."""
    tags = ["entries", "benchmark"]

    try:
        items = await get_benchmarks(conn, request.ids)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetBenchmarkEntriesApiResponse(
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
            operation="get_benchmark_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
