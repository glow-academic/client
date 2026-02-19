"""Test Invocation entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.test_invocation.create import router as create_router
from app.api.v4.entries.test_invocation.get import router as get_router
from app.api.v4.entries.test_invocation.refresh import router as refresh_router
from app.api.v4.entries.test_invocation.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(create_router)
router.include_router(search_router)
router.include_router(refresh_router)
