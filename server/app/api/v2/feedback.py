"""Feedback v2 API endpoints."""

from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.schemas.feedback import (BulkDeleteFeedbackRequest,
                                  BulkDeleteFeedbackResponse,
                                  CreateFeedbackRequest,
                                  CreateFeedbackResponse, FeedbackListRequest,
                                  FeedbackListResponse)
from app.services.feedback_service import get_feedback_service
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


@router.post("/list", response_model=FeedbackListResponse)
async def list_feedback(
    request: FeedbackListRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FeedbackListResponse:
    """Get list of feedback with author information."""
    service = get_feedback_service(conn)
    return await service.get_feedback_list(request)


@router.post("/create", response_model=CreateFeedbackResponse)
async def create_feedback(
    request: CreateFeedbackRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateFeedbackResponse:
    """Create new app feedback entry."""
    try:
        service = get_feedback_service(conn)
        return await service.create_feedback(request)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bulk-delete", response_model=BulkDeleteFeedbackResponse)
async def bulk_delete_feedback(
    request: BulkDeleteFeedbackRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> BulkDeleteFeedbackResponse:
    """Bulk delete feedback. Only superadmin can delete feedback."""
    try:
        service = get_feedback_service(conn)
        return await service.bulk_delete_feedback(request)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete feedback: {str(e)}")
