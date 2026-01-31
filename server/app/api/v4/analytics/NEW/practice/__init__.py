"""Practice analytics router (NEW MV-based implementation)."""

from fastapi import APIRouter

from app.api.v4.analytics.NEW.practice.attempt import router as attempt_router
from app.api.v4.analytics.NEW.practice.get import router as get_router
from app.api.v4.analytics.NEW.practice.list import router as list_router

router = APIRouter(prefix="/practice", tags=["analytics", "new", "practice"])

router.include_router(get_router)
router.include_router(list_router)
router.include_router(attempt_router)
