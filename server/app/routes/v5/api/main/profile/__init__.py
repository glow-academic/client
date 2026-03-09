"""Profile v4 router."""

from fastapi import APIRouter

from app.routes.v5.api.main.profile.create import router as create_router
from app.routes.v5.api.main.profile.delete import router as delete_router
from app.routes.v5.api.main.profile.docs import router as docs_router
from app.routes.v5.api.main.profile.draft import router as draft_router
from app.routes.v5.api.main.profile.duplicate import router as duplicate_router
from app.routes.v5.api.main.profile.export import router as export_router
from app.routes.v5.api.main.profile.get import router as get_router
from app.routes.v5.api.main.profile.refresh import router as refresh_router
from app.routes.v5.api.main.profile.search import router as search_router
from app.routes.v5.api.main.profile.update import router as update_router

router = APIRouter(prefix="/profiles", tags=["profiles"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(get_router)
router.include_router(search_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(draft_router)
router.include_router(delete_router)
router.include_router(docs_router)
router.include_router(export_router)
router.include_router(refresh_router)
