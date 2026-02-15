"""Image views API routes."""

from fastapi import APIRouter

from app.api.v4.views.image.list import router as list_router

router = APIRouter(prefix="/image", tags=["views", "image"])

router.include_router(list_router, prefix="/list", tags=["list"])
