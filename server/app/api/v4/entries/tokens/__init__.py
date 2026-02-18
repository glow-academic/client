"""Tokens entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.tokens.create import router as create_router
from app.api.v4.entries.tokens.get import router as get_router
from app.api.v4.entries.tokens.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(create_router)
router.include_router(search_router)
