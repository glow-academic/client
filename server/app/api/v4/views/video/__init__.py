"""Video views API routes."""

from fastapi import APIRouter

from app.api.v4.views.video.list import router as list_router

router = APIRouter(prefix="/video", tags=["views", "video"])

router.include_router(list_router, prefix="/list", tags=["list"])
