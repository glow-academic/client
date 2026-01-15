"""Scenarios v4 router."""

from fastapi import APIRouter

from app.api.v4.scenarios.create import router as create_router
from app.api.v4.scenarios.delete import router as delete_router
from app.api.v4.scenarios.detail import router as detail_router
from app.api.v4.scenarios.duplicate import router as duplicate_router
from app.api.v4.scenarios.get import router as get_router
from app.api.v4.scenarios.list import router as list_router
from app.api.v4.scenarios.new import router as new_router
from app.api.v4.scenarios.save import router as save_router
from app.api.v4.scenarios.update import router as update_router

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

# Include unified endpoints first (get, save)
router.include_router(get_router)
router.include_router(save_router)

# Include old endpoints temporarily for compatibility (will be removed after frontend migration)
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
