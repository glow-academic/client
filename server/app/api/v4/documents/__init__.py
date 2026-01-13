"""Documents v4 API routes."""

from fastapi import APIRouter

from app.api.v4.documents.certificate import router as certificate_router
from app.api.v4.documents.create import router as create_router
from app.api.v4.documents.delete import router as delete_router
from app.api.v4.documents.detail import router as detail_router
from app.api.v4.documents.get import router as get_router
from app.api.v4.documents.list import router as list_router
from app.api.v4.documents.render import router as render_router
from app.api.v4.documents.save import router as save_router
from app.api.v4.documents.update import router as update_router

router = APIRouter(prefix="/documents", tags=["documents"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)  # New unified get endpoint
router.include_router(save_router)  # New unified save endpoint
# Keep old endpoints temporarily for backward compatibility (deprecated)
router.include_router(detail_router)  # DEPRECATED: Use get endpoint instead
router.include_router(create_router)  # DEPRECATED: Use save endpoint instead
router.include_router(delete_router)
router.include_router(update_router)  # DEPRECATED: Use save endpoint instead
router.include_router(certificate_router)
router.include_router(render_router)
