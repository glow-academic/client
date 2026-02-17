"""Analytics views — deprecated. All analytics endpoints moved to /views/chat."""

from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["views", "analytics"])
