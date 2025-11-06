"""Documents v3 API routes."""

from fastapi import APIRouter

from app.api.v3.documents.bulk_delete import router as bulk_delete_router
from app.api.v3.documents.bulk_update import router as bulk_update_router
from app.api.v3.documents.certificate import router as certificate_router
from app.api.v3.documents.delete import router as delete_router
from app.api.v3.documents.detail import router as detail_router
from app.api.v3.documents.detail_bulk import router as detail_bulk_router
from app.api.v3.documents.download import router as download_router
from app.api.v3.documents.list import router as list_router
from app.api.v3.documents.upload_chunk import router as upload_chunk_router
from app.api.v3.documents.upload_finalize import router as upload_finalize_router
from app.api.v3.documents.upload_init import router as upload_init_router
from app.api.v3.documents.update import router as update_router

router = APIRouter(prefix="/documents", tags=["documents"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_bulk_router)
router.include_router(delete_router)
router.include_router(bulk_update_router)
router.include_router(bulk_delete_router)
router.include_router(update_router)
router.include_router(upload_init_router)
router.include_router(upload_chunk_router)
router.include_router(upload_finalize_router)
router.include_router(download_router)
router.include_router(certificate_router)

