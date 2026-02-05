"""Dashboard artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.dashboard.get import router as get_router
from app.api.v4.artifacts.dashboard.refresh import router as refresh_router

router = APIRouter()
router.include_router(get_router)
router.include_router(refresh_router)
