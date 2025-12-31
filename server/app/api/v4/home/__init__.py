"""Home v4 API router."""

from fastapi import APIRouter

from app.api.v4.home.history import router as history_router
from app.api.v4.home.overview import router as overview_router

router = APIRouter(prefix="/home", tags=["home"])
router.include_router(overview_router)
router.include_router(history_router)
