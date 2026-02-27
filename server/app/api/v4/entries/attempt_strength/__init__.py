"""Attempt Strength entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.attempt_strength.get import router as get_router
from app.api.v4.entries.attempt_strength.refresh import router as refresh_router
from app.api.v4.entries.attempt_strength.search import router as search_router
from app.api.v4.entries.attempt_strength.create import router as create_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
router.include_router(create_router)
