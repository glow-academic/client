"""Profile v4 router."""

from fastapi import APIRouter

from app.routes.v5.api.main.profile.bulk import router as bulk_router
from app.routes.v5.api.main.profile.delete import router as delete_router
from app.routes.v5.api.main.profile.docs import router as docs_router
from app.routes.v5.api.main.profile.draft import router as draft_router
from app.routes.v5.api.main.profile.duplicate import router as duplicate_router
from app.routes.v5.api.main.profile.get import router as get_router
from app.routes.v5.api.main.profile.list import router as list_router
from app.routes.v5.api.main.profile.save import router as save_router

router = APIRouter(prefix="/profiles", tags=["profiles"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(draft_router)
router.include_router(delete_router)
router.include_router(bulk_router)
router.include_router(docs_router)
