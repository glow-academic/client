"""Practice v3 API router."""

from fastapi import APIRouter

from app.api.v3.practice.history import router as history_router
from app.api.v3.practice.overview import router as overview_router

router = APIRouter(prefix="/practice", tags=["practice"])
router.include_router(overview_router)
router.include_router(history_router)
