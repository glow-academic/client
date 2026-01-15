"""Health analytics router."""

from app.api.v4.analytics.health.get import router as get_router
from app.api.v4.analytics.health.list import router as list_router
from fastapi import APIRouter

router = APIRouter(prefix="/health", tags=["analytics", "health"])

router.include_router(get_router)
router.include_router(list_router)
