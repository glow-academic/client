"""Texts endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.storage.file_writer import write_text_file
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    TextsApiRequest,
    TextsApiResponse,
    TextsSqlParams,
    TextsSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/resources/texts_complete.sql"

router = APIRouter()


@router.post("/texts", response_model=TextsApiResponse)
async def create_texts(
    request: TextsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> TextsApiResponse:
    """Create texts resource (always INSERT)."""
    tags = ["resources", "texts"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            mcp = getattr(http_request.state, "mcp", False) or False

            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            # Write content to disk, pass upload_id to SQL
            content = request_dict.pop("content", "")
            upload_id = await write_text_file(conn, None, content)
            request_dict["upload_id"] = upload_id
            params = TextsSqlParams(**request_dict)
            sql_params = params.to_tuple()

            result = cast(
                TextsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.texts_id:
                raise ValueError("Failed to create texts")

        api_response = TextsApiResponse.model_validate(result.model_dump())

        await invalidate_tags(tags)
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
            operation="create_texts",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
