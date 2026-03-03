"""Resolves entry endpoints."""

from fastapi import APIRouter

from app.v5.api.entries.resolves.create import router as create_router
from app.v5.api.entries.resolves.get import router as get_router
from app.v5.api.entries.resolves.refresh import router as refresh_router
from app.v5.api.entries.resolves.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(create_router)
router.include_router(search_router)
router.include_router(refresh_router)
