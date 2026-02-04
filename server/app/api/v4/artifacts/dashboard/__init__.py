"""Dashboard artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.dashboard.get import router as get_router

router = APIRouter()
router.include_router(get_router)
