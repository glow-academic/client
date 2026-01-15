"""{section.title()} analytics router."""

from fastapi import APIRouter

from app.api.v4.analytics.reports.get import router as get_router
from app.api.v4.analytics.reports.list import router as list_router

router = APIRouter(prefix="/reports", tags=["analytics", "reports"])

router.include_router(get_router)
router.include_router(list_router)
