"""Upload views API routes."""

from fastapi import APIRouter

from app.api.v4.views.upload.list import router as list_router

router = APIRouter(prefix="/upload", tags=["views", "upload"])

router.include_router(list_router, prefix="/list", tags=["list"])
