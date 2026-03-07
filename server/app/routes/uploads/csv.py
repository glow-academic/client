"""CSV parsing endpoint — reads a TUS-uploaded CSV and returns headers + rows."""

import csv
import io
import os
from typing import Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.infra.globals import UPLOAD_FOLDER, get_db
from app.sql.types import (
    GetUploadFileInfoSqlParams,
    GetUploadFileInfoSqlRow,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/uploads/get_upload_file_info_complete.sql"

router = APIRouter()


class ParseCsvApiRequest(BaseModel):
    """Request model for CSV parse endpoint."""

    upload_id: UUID


class ParseCsvApiResponse(BaseModel):
    """Response model for CSV parse endpoint."""

    headers: list[str]
    rows: list[list[str]]
    row_count: int


@router.post("/csv", response_model=ParseCsvApiResponse)
async def parse_csv(
    body: ParseCsvApiRequest,
    http_request: Request,
    db: asyncpg.Pool = Depends(get_db),
) -> ParseCsvApiResponse:
    """Parse a previously uploaded CSV file and return headers + rows."""
    sql_params: tuple[Any, ...] | None = None
    try:
        profile_id = http_request.state.profile_id
        params = GetUploadFileInfoSqlParams(
            upload_id=body.upload_id, profile_id=profile_id
        )
        sql_params = params.to_tuple()

        result = cast(
            GetUploadFileInfoSqlRow,
            await execute_sql_typed(db, SQL_PATH, params=params),
        )

        if not result.upload_exists:
            raise HTTPException(status_code=404, detail="Upload not found")

        stored_path = result.file_path or ""
        file_path = os.path.join(UPLOAD_FOLDER, stored_path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Upload file not found")

        # Read CSV with BOM handling (Excel exports UTF-8 with BOM)
        with open(file_path, encoding="utf-8-sig") as f:
            content = f.read()

        reader = csv.reader(io.StringIO(content))
        all_rows = list(reader)

        if not all_rows:
            return ParseCsvApiResponse(headers=[], rows=[], row_count=0)

        headers = all_rows[0]
        data_rows = all_rows[1:]

        return ParseCsvApiResponse(
            headers=headers,
            rows=data_rows,
            row_count=len(data_rows),
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="parse_csv",
            sql_query=SQL_PATH,
            sql_params=sql_params,
            request=http_request,
        )
