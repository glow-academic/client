"""Log v2 API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.logs import (BulkDeleteLogsRequest, BulkDeleteLogsResponse,
                              CreateLogRequest, CreateLogResponse,
                              LogsListRequest, LogsListResponse)
from app.services.log_service import get_log_service
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


@router.post("/list", response_model=LogsListResponse)
async def list_logs(
    request: LogsListRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LogsListResponse:
    """Get list of logs with actor information and all JSONB fields."""
    service = get_log_service(conn)
    return await service.get_logs_list(request)


@router.post("/create", response_model=CreateLogResponse)
async def create_log(
    request: CreateLogRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateLogResponse:
    """Create a new log entry."""
    try:
        service = get_log_service(conn)
        return await service.create_log(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create log: {str(e)}")


@router.post("/bulk-delete", response_model=BulkDeleteLogsResponse)
async def bulk_delete_logs(
    request: BulkDeleteLogsRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteLogsResponse:
    """Bulk delete logs. Only superadmin can delete logs."""
    try:
        service = get_log_service(conn)
        return await service.bulk_delete_logs(request)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete logs: {str(e)}"
        )
