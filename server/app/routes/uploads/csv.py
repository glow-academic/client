"""CSV parsing endpoint — reads a TUS-uploaded CSV and returns headers + rows."""

import csv
import io
import os
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.infra.globals import UPLOAD_FOLDER, get_pool
from app.routes.v5.tools.entries.uploads.get import get_upload
from app.utils.error.handle_route_error import handle_route_error

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
) -> ParseCsvApiResponse:
    """Parse a previously uploaded CSV file and return headers + rows."""
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            result = await get_upload(conn, body.upload_id)

        if result is None:
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
            request=http_request,
        )
