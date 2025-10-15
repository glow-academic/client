"""Attempts v2 API endpoints."""

from typing import Annotated, Any, Dict
from uuid import UUID

from app.db import get_session
from app.queries.simulation_queries import get_attempt_full_data
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

router = APIRouter(prefix="/attempts", tags=["attempts"])


@router.get("/{attempt_id}/full")
async def get_attempt_full(
    attempt_id: UUID,
    db: Annotated[Session, Depends(get_session)],
) -> Dict[str, Any]:
    """Get complete attempt data with all related entities and computed values."""
    try:
        return get_attempt_full_data(db, attempt_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

