"""Text views API routes."""

from fastapi import APIRouter

from app.api.v4.views.text.list import router as list_router

router = APIRouter(prefix="/text", tags=["views", "text"])

router.include_router(list_router, prefix="/list", tags=["list"])
