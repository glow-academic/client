"""Artifacts views API routes."""

from fastapi import APIRouter

from app.api.v4.views.artifacts.session_list import router as session_list_router
from app.api.v4.views.artifacts.session_detail import router as session_detail_router

router = APIRouter(prefix="/artifacts", tags=["views", "artifacts"])

router.include_router(session_list_router, prefix="/session-list", tags=["session_list"])
router.include_router(session_detail_router, prefix="/session-detail", tags=["session_detail"])
