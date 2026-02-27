"""Attempt Replacement entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.attempt_replacement.get import router as get_router
from app.api.v4.entries.attempt_replacement.refresh import router as refresh_router
from app.api.v4.entries.attempt_replacement.search import router as search_router
from app.api.v4.entries.attempt_replacement.create import router as create_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(create_router)
