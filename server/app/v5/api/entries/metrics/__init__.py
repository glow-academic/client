"""Metrics entry endpoints."""

from fastapi import APIRouter

from app.v5.api.entries.metrics.get import router as get_router
from app.v5.api.entries.metrics.refresh import router as refresh_router
from app.v5.api.entries.metrics.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
