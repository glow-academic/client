"""Scenarios v4 router."""

from app.api.v4.scenarios.delete import router as delete_router
from app.api.v4.scenarios.duplicate import router as duplicate_router
from app.api.v4.scenarios.get import router as get_router
from app.api.v4.scenarios.list import router as list_router
from app.api.v4.scenarios.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

# Include unified endpoints (get, save)
router.include_router(get_router)
router.include_router(save_router)

# Include other endpoints
router.include_router(list_router)
router.include_router(duplicate_router)
router.include_router(delete_router)

# Note: new.py, detail.py, create.py, update.py removed - use /get and /save instead
