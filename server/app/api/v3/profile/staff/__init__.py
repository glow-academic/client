"""Staff v3 API endpoints - staff management operations."""

from fastapi import APIRouter

from .bulk_create import router as bulk_create_router
from .bulk_create_or_update_staff import router as bulk_create_or_update_staff_router
from .bulk_delete import router as bulk_delete_router
from .bulk_update import router as bulk_update_router
from .create import router as create_router
from .create_or_update_staff import router as create_or_update_staff_router
from .create_staff_data import router as create_staff_data_router
from .delete import router as delete_router
from .detail import router as detail_router
from .detail_bulk import router as detail_bulk_router
from .list import router as list_router
from .process_csv import router as process_csv_router
from .search_staff import router as search_staff_router
from .update import router as update_router

router = APIRouter(prefix="/staff", tags=["staff"])

# Include all staff endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(detail_bulk_router)
router.include_router(create_router)
router.include_router(bulk_create_router)
router.include_router(update_router)
router.include_router(bulk_update_router)
router.include_router(delete_router)
router.include_router(bulk_delete_router)
router.include_router(create_staff_data_router)
router.include_router(search_staff_router)
router.include_router(process_csv_router)
router.include_router(create_or_update_staff_router)
router.include_router(bulk_create_or_update_staff_router)

