"""{section.title()} analytics router."""

from fastapi import APIRouter

from app.api.v4.analytics.dashboard.get import router as get_router
from app.api.v4.analytics.dashboard.list import router as list_router

router = APIRouter(prefix="/dashboard", tags=["analytics", "dashboard"])

router.include_router(get_router)
router.include_router(list_router)
