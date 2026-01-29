"""Setting v4 router."""

from fastapi import APIRouter

from app.api.v4.artifacts.setting.delete import router as delete_router
from app.api.v4.artifacts.setting.draft import router as draft_router
from app.api.v4.artifacts.setting.duplicate import router as duplicate_router
from app.api.v4.artifacts.setting.get import router as get_router
from app.api.v4.artifacts.setting.list import router as list_router
from app.api.v4.artifacts.setting.save import router as save_router

router = APIRouter(prefix="/settings", tags=["settings"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
