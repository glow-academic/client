"""{section.title()} analytics router."""

from fastapi import APIRouter

from app.api.v4.analytics.home.get import router as get_router
from app.api.v4.analytics.home.list import router as list_router

router = APIRouter(prefix="/home", tags=["analytics", "home"])

router.include_router(get_router)
router.include_router(list_router)
