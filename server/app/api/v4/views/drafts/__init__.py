"""Drafts views router."""

from fastapi import APIRouter

from app.api.v4.views.drafts.get import router as get_router

router = APIRouter(prefix="/drafts", tags=["views", "drafts"])

router.include_router(get_router)
