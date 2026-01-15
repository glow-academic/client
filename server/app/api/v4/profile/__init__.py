"""Profile v4 API endpoints - single profile operations."""

from fastapi import APIRouter

from .context import router as context_router
from .delete import router as delete_router
from .email import router as email_router
from .emulate import router as emulate_router
from .get import router as get_router
from .save import router as save_router
from .simulatable import router as simulatable_router
from .upsert import router as upsert_router

router = APIRouter(prefix="/profile", tags=["profile"])

# Include unified endpoints (get, save)
router.include_router(get_router)
router.include_router(save_router)

# Include other endpoints
router.include_router(delete_router)
router.include_router(upsert_router)
router.include_router(email_router)
router.include_router(context_router)
router.include_router(emulate_router)
router.include_router(simulatable_router)

# Note: new.py, detail.py, create.py, update.py removed - use /get and /save instead
