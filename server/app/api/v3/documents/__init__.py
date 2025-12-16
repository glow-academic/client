"""Documents v3 API routes."""

from fastapi import APIRouter

from app.api.v3.documents.certificate import router as certificate_router
from app.api.v3.documents.create import router as create_router
from app.api.v3.documents.delete import router as delete_router
from app.api.v3.documents.detail import router as detail_router
from app.api.v3.documents.list import router as list_router
from app.api.v3.documents.render import router as render_router
from app.api.v3.documents.update import router as update_router

router = APIRouter(prefix="/documents", tags=["documents"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(create_router)
router.include_router(delete_router)
router.include_router(update_router)
router.include_router(certificate_router)
router.include_router(render_router)
