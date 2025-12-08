"""Uploads v3 API routes."""

from fastapi import APIRouter

from app.api.v3.uploads.classify import router as classify_router
from app.api.v3.uploads.download import router as download_router
from app.api.v3.uploads.tus_create import router as tus_create_router
from app.api.v3.uploads.tus_finalize import router as tus_finalize_router
from app.api.v3.uploads.tus_head import router as tus_head_router
from app.api.v3.uploads.tus_options import router as tus_options_router
from app.api.v3.uploads.tus_patch import router as tus_patch_router

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Include endpoint routers
router.include_router(tus_options_router)
router.include_router(tus_create_router)
router.include_router(tus_head_router)
router.include_router(tus_patch_router)
router.include_router(tus_finalize_router)
router.include_router(classify_router)
router.include_router(download_router)
