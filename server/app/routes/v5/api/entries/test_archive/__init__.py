"""Test Archive entry endpoints."""

from fastapi import APIRouter

from app.routes.v5.api.entries.test_archive.create import router as create_router
from app.routes.v5.api.entries.test_archive.get import router as get_router
from app.routes.v5.api.entries.test_archive.refresh import router as refresh_router
from app.routes.v5.api.entries.test_archive.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(create_router)
router.include_router(search_router)
router.include_router(refresh_router)
