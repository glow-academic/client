"""Texts resources router."""

from fastapi import APIRouter

from app.v5.api.resources.texts.get import router as get_router
from app.v5.api.resources.texts.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
