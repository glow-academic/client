"""Uploads v3 API routes."""

from fastapi import APIRouter

from app.api.v3.uploads.classify import router as classify_router
from app.api.v3.uploads.download import router as download_router
from app.api.v3.uploads.finalize import router as finalize_router
from app.api.v3.uploads.head import router as head_router
from app.api.v3.uploads.options import router as options_router
from app.api.v3.uploads.patch import router as patch_router
from app.api.v3.uploads.upload import router as upload_router

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Include endpoint routers
router.include_router(options_router)
router.include_router(upload_router)
router.include_router(head_router)
router.include_router(patch_router)
router.include_router(finalize_router)
router.include_router(classify_router)
router.include_router(download_router)
