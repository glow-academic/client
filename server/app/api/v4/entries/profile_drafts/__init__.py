"""Profile Drafts entry endpoints."""

from fastapi import APIRouter

from app.api.v4.entries.profile_drafts.get import router as get_router
from app.api.v4.entries.profile_drafts.refresh import router as refresh_router
from app.api.v4.entries.profile_drafts.search import router as search_router

router = APIRouter()
router.include_router(get_router)
router.include_router(search_router)
router.include_router(refresh_router)
