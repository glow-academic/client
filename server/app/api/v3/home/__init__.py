"""Home v3 API router."""

from app.api.v3.home.history import router as history_router
from app.api.v3.home.overview import router as overview_router
from fastapi import APIRouter

router = APIRouter(prefix="/home", tags=["home"])
router.include_router(overview_router)
router.include_router(history_router)
