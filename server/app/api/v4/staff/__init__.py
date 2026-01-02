"""Staff v4 API endpoints - multiple profile operations."""

from fastapi import APIRouter

from .create import router as create_router
from .csv import router as csv_router
from .data import router as data_router
from .delete import router as delete_router
from .detail import router as detail_router
from .draft import router as draft_router
from .list import router as list_router
from .new import router as new_router
from .search import router as search_router
from .update import router as update_router
from .upsert import router as upsert_router

router = APIRouter(prefix="/staff", tags=["staff"])

# Include all staff endpoint routers (multiple profile operations)
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(draft_router)
router.include_router(search_router)
router.include_router(csv_router)
router.include_router(data_router)
# Bulk operations (multiple profiles)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(upsert_router)
