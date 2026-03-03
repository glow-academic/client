"""Practice entry endpoints."""

from fastapi import APIRouter

from app.v5.api.entries.practice.get import router as get_router
from app.v5.api.entries.practice.refresh import router as refresh_router
from app.v5.api.entries.practice.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
