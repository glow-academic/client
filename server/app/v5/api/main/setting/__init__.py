"""Setting v4 router."""

from fastapi import APIRouter

from app.v5.api.main.setting.delete import router as delete_router
from app.v5.api.main.setting.docs import router as docs_router
from app.v5.api.main.setting.draft import router as draft_router
from app.v5.api.main.setting.duplicate import router as duplicate_router
from app.v5.api.main.setting.get import router as get_router
from app.v5.api.main.setting.list import router as list_router
from app.v5.api.main.setting.save import router as save_router

router = APIRouter(prefix="/settings", tags=["settings"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)
