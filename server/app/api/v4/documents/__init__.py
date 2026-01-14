"""Documents v4 API routes."""

from app.api.v4.documents.certificate import router as certificate_router
from app.api.v4.documents.delete import router as delete_router
from app.api.v4.documents.get import router as get_router
from app.api.v4.documents.list import router as list_router
from app.api.v4.documents.render import router as render_router
from app.api.v4.documents.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/documents", tags=["documents"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(delete_router)
router.include_router(certificate_router)
router.include_router(render_router)
