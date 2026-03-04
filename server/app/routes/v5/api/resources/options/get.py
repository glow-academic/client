"""Options GET endpoint - v4 API.

Provides get endpoint for batch fetching options by IDs.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.options.types import (
    GetOptionsApiRequest,
    GetOptionsApiResponse,
    GetOptionV4Item,
)
from app.routes.v5.tools.resources.options.get import (
    BATCH_SQL_PATH,
    get_options_internal,
)
from app.sql.types import (
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/options/get",
    response_model=GetOptionsApiResponse,
)
async def get_options(
    request: GetOptionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetOptionsApiResponse:
    """Get options by IDs."""
    tags = ["resources", "options"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        items = await get_options_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetOptionsApiResponse(
            items=[
                GetOptionV4Item(
                    option_id=item.option_id,
                    option_text=item.option_text,
                    is_correct=item.is_correct,
                    generated=item.generated,
                )
                for item in items
            ]
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_options",
            sql_query=load_sql_query(BATCH_SQL_PATH),
            sql_params=None,
            request=http_request,
        )
