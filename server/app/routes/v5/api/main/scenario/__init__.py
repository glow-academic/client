"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.routes.v5.api.main.scenario.create import router as create_router
from app.routes.v5.api.main.scenario.delete import router as delete_router
from app.routes.v5.api.main.scenario.docs import router as docs_router
from app.routes.v5.api.main.scenario.draft import router as draft_router
from app.routes.v5.api.main.scenario.drafts import router as drafts_router
from app.routes.v5.api.main.scenario.duplicate import router as duplicate_router
from app.routes.v5.api.main.scenario.export import router as export_router
from app.routes.v5.api.main.scenario.get import router as get_router
from app.routes.v5.api.main.scenario.refresh import router as refresh_router
from app.routes.v5.api.main.scenario.search import router as search_router
from app.routes.v5.api.main.scenario.update import router as update_router

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(search_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(drafts_router)
router.include_router(export_router)
router.include_router(docs_router)
router.include_router(refresh_router)
