"""Home Training entry endpoints."""

from fastapi import APIRouter

from app.routes.v5.api.entries.home_training.get import router as get_router
from app.routes.v5.api.entries.home_training.refresh import router as refresh_router
from app.routes.v5.api.entries.home_training.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
