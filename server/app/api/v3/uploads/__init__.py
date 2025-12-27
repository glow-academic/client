"""Uploads v3 API routes."""

from fastapi import APIRouter

from app.api.v3.uploads.download import router as download_router
from app.api.v3.uploads.tus import router as tus_router

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Include endpoint routers
router.include_router(tus_router)
router.include_router(download_router)
