"""Test entry endpoints."""

from fastapi import APIRouter

from app.routes.v5.api.entries.test.create import router as create_router
from app.routes.v5.api.entries.test.get import router as get_router
from app.routes.v5.api.entries.test.refresh import router as refresh_router
from app.routes.v5.api.entries.test.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(create_router)
