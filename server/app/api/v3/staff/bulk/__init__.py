"""Staff bulk operations router."""

from fastapi import APIRouter

from .create import router as create_router
from .delete import router as delete_router
from .update import router as update_router
from .upsert import router as upsert_router

router = APIRouter(prefix="/bulk", tags=["staff"])

# Include bulk operation routers
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(upsert_router)

