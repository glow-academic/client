"""{section.title()} analytics router."""

from fastapi import APIRouter

from app.api.v4.analytics.practice.get import router as get_router
from app.api.v4.analytics.practice.list import router as list_router

router = APIRouter(prefix="/practice", tags=["analytics", "practice"])

router.include_router(get_router)
router.include_router(list_router)
