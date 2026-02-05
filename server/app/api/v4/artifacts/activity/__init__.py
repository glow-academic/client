"""Activity artifact router."""

from fastapi import APIRouter

from app.api.v4.artifacts.activity.get import router as get_router
from app.api.v4.artifacts.activity.refresh import router as refresh_router

router = APIRouter()
router.include_router(get_router)
router.include_router(refresh_router)
