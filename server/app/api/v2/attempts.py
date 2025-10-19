"""Attempts v2 API endpoints."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException

from app.db import get_db
from app.queries.simulation_queries import get_attempt_full_data
from app.schemas.attempts import (
    BulkArchiveAttemptsRequest,
    BulkArchiveAttemptsResponse,
    UpdateChatCompletedAtRequest,
    UpdateChatCreatedAtRequest,
    UpdateChatTimestampResponse,
)
from app.services.attempts_service import get_attempts_service

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.get("/{attempt_id}/full")
async def get_attempt_full(
    attempt_id: UUID,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict[str, Any]:
    """Get complete attempt data with all related entities and computed values."""
    try:
        return await get_attempt_full_data(conn, str(attempt_id))
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-archive", response_model=BulkArchiveAttemptsResponse)
async def bulk_archive_attempts(
    request: BulkArchiveAttemptsRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkArchiveAttemptsResponse:
    """Bulk archive or unarchive simulation attempts."""
    try:
        service = get_attempts_service(conn)
        return await service.bulk_archive_attempts(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chats/update-created-at", response_model=UpdateChatTimestampResponse)
async def update_chat_created_at(
    request: UpdateChatCreatedAtRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateChatTimestampResponse:
    """Update simulation chat createdAt timestamp."""
    try:
        service = get_attempts_service(conn)
        return await service.update_chat_created_at(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chats/update-completed-at", response_model=UpdateChatTimestampResponse)
async def update_chat_completed_at(
    request: UpdateChatCompletedAtRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateChatTimestampResponse:
    """Update simulation chat completedAt timestamp."""
    try:
        service = get_attempts_service(conn)
        return await service.update_chat_completed_at(request)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
