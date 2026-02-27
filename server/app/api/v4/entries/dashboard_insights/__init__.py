"""Dashboard Insights entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.dashboard_insights.get import router as get_router
from app.api.v4.entries.dashboard_insights.refresh import router as refresh_router
from app.api.v4.entries.dashboard_insights.search import router as search_router
from app.api.v4.entries.dashboard_insights.create import router as create_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(create_router)
