"""Document v4 router."""

from fastapi import APIRouter

from app.routes.v5.api.main.document.create import router as create_router
from app.routes.v5.api.main.document.delete import router as delete_router
from app.routes.v5.api.main.document.docs import router as docs_router
from app.routes.v5.api.main.document.draft import router as draft_router
from app.routes.v5.api.main.document.drafts import router as drafts_router
from app.routes.v5.api.main.document.duplicate import router as duplicate_router
from app.routes.v5.api.main.document.export import router as export_router
from app.routes.v5.api.main.document.get import router as get_router
from app.routes.v5.api.main.document.refresh import router as refresh_router
from app.routes.v5.api.main.document.search import router as search_router
from app.routes.v5.api.main.document.update import router as update_router

router = APIRouter(prefix="/documents", tags=["documents"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(search_router)
router.include_router(get_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(drafts_router)
router.include_router(docs_router)
router.include_router(refresh_router)
router.include_router(export_router)
