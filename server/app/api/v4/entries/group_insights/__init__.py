"""Group Insights entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.group_insights.search import router as search_router
from app.api.v4.entries.group_insights.create import router as create_router

router = APIRouter()
router.include_router(search_router)
router.include_router(create_router)
