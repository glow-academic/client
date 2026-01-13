"""Parameters resource router."""

from app.api.v4.parameters.delete import router as delete_router
from app.api.v4.parameters.duplicate import router as duplicate_router
from app.api.v4.parameters.get import router as get_router
from app.api.v4.parameters.list import router as list_router
from app.api.v4.parameters.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/parameters", tags=["parameters"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
