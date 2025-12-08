"""Dashboard v3 API router."""

from fastapi import APIRouter

from app.api.v3.dashboard.bundle import router as overview_router
from app.api.v3.dashboard.history import router as history_router

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
router.include_router(overview_router)
router.include_router(history_router)
