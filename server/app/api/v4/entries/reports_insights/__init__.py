"""Reports Insights entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.reports_insights.get import router as get_router
from app.api.v4.entries.reports_insights.refresh import router as refresh_router
from app.api.v4.entries.reports_insights.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
