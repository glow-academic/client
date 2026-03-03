"""Practice Training entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.practice_training.get import (
    SQL_PATH,
    get_practice_training_entries_internal,
)
from app.sql.types import (
    GetPracticeTrainingEntriesApiRequest,
    GetPracticeTrainingEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/practice_training/get",
    response_model=GetPracticeTrainingEntriesApiResponse,
)
async def get_practice_training_entries(
    request: GetPracticeTrainingEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPracticeTrainingEntriesApiResponse:
    """Get practice_training entries by IDs."""
    tags = ["entries", "practice_training"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_practice_training_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetPracticeTrainingEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_practice_training_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
