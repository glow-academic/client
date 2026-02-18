"""Activity Insights entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.activity_insights.create import router as create_router
from app.api.v4.entries.activity_insights.get import router as get_router
from app.api.v4.entries.activity_insights.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(create_router)
router.include_router(search_router)
