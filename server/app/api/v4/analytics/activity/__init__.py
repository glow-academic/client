"""{section.title()} analytics router."""

from fastapi import APIRouter

from app.api.v4.analytics.activity.get import router as get_router
from app.api.v4.analytics.activity.list import router as list_router

router = APIRouter(prefix="/activity", tags=["analytics", "activity"])

router.include_router(get_router)
router.include_router(list_router)
