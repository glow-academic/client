"""Audios entry endpoints."""

from fastapi import APIRouter

from app.routes.v5.api.entries.audios.get import router as get_router
from app.routes.v5.api.entries.audios.refresh import router as refresh_router
from app.routes.v5.api.entries.audios.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
