"""Audio views API routes."""

from fastapi import APIRouter

from app.api.v4.views.audio.list import router as list_router

router = APIRouter(prefix="/audio", tags=["views", "audio"])

router.include_router(list_router, prefix="/list", tags=["list"])
