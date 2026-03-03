"""Uploads workflow router — TUS protocol, finalization, download, preview, template."""

from fastapi import APIRouter

from app.routes.uploads.chunk import router as chunk_router
from app.routes.uploads.create import router as create_router
from app.routes.uploads.csv import router as csv_router
from app.routes.uploads.discover import router as discover_router
from app.routes.uploads.download import router as download_router
from app.routes.uploads.finalize import router as finalize_router
from app.routes.uploads.preview import router as preview_router
from app.routes.uploads.status import router as status_router
from app.routes.uploads.template import router as template_router

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
