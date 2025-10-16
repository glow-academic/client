"""Attempts v2 API endpoints."""

from datetime import datetime
from typing import Annotated, Any, Dict
from uuid import UUID

from app.db import get_db
from app.models import SimulationChats
from app.queries.simulation_queries import get_attempt_full_data
from app.repositories.attempts_repository import get_attempts_repository
from app.schemas.attempts import (BulkArchiveAttemptsRequest,
                                  BulkArchiveAttemptsResponse,
                                  UpdateChatCompletedAtRequest,
                                  UpdateChatCreatedAtRequest,
                                  UpdateChatTimestampResponse)
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.get("/{attempt_id}/full")
async def get_attempt_full(
    attempt_id: UUID,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Dict[str, Any]:
    """Get complete attempt data with all related entities and computed values."""
    try:
        return get_attempt_full_data(db, attempt_id)
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
        repo = get_attempts_repository(conn)
        return await repo.bulk_archive_attempts(request)
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
        # Find the chat
        chat = db.exec(
            select(SimulationChats).where(SimulationChats.id == request.chatId)
        ).one_or_none()

        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat not found: {request.chatId}")

        # Update the createdAt timestamp - parse ISO string to datetime
        chat.created_at = datetime.fromisoformat(request.createdAt.replace('Z', '+00:00'))
        db.add(chat)
        db.commit()

        return UpdateChatTimestampResponse(
            success=True,
            message=f"Chat {request.chatId} createdAt updated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chats/update-completed-at", response_model=UpdateChatTimestampResponse)
async def update_chat_completed_at(
    request: UpdateChatCompletedAtRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateChatTimestampResponse:
    """Update simulation chat completedAt timestamp."""
    try:
        # Find the chat
        chat = db.exec(
            select(SimulationChats).where(SimulationChats.id == request.chatId)
        ).one_or_none()

        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat not found: {request.chatId}")

        # Update the completedAt timestamp - parse ISO string to datetime
        chat.completed_at = datetime.fromisoformat(request.completedAt.replace('Z', '+00:00'))
        db.add(chat)
        db.commit()

        return UpdateChatTimestampResponse(
            success=True,
            message=f"Chat {request.chatId} completedAt updated successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

