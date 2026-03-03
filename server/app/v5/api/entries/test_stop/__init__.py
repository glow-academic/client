"""Test Stop entry endpoints."""

from fastapi import APIRouter

from app.v5.api.entries.test_stop.create import router as create_router
from app.v5.api.entries.test_stop.get import router as get_router
from app.v5.api.entries.test_stop.refresh import router as refresh_router
from app.v5.api.entries.test_stop.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(create_router)
