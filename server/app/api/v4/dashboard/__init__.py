"""Dashboard v4 API router."""

from fastapi import APIRouter

from app.api.v4.dashboard.bundle import router as overview_router
from app.api.v4.dashboard.history import router as history_router

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
router.include_router(overview_router)
router.include_router(history_router)
