"""Uploads workflow router — TUS protocol, finalization, download, preview, template."""

from fastapi import APIRouter

from app.api.v4.uploads.chunk import router as chunk_router
from app.api.v4.uploads.create import router as create_router
from app.api.v4.uploads.csv import router as csv_router
from app.api.v4.uploads.discover import router as discover_router
from app.api.v4.uploads.download import router as download_router
from app.api.v4.uploads.finalize import router as finalize_router
from app.api.v4.uploads.preview import router as preview_router
from app.api.v4.uploads.status import router as status_router
from app.api.v4.uploads.template import router as template_router

router = APIRouter(prefix="/uploads", tags=["uploads"])

router.include_router(discover_router)
router.include_router(create_router)
router.include_router(status_router)
router.include_router(chunk_router)
router.include_router(finalize_router)
router.include_router(download_router)
router.include_router(preview_router)
router.include_router(template_router)
router.include_router(csv_router)
