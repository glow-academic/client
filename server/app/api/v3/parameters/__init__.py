"""Parameters resource router."""

from fastapi import APIRouter

from app.api.v3.parameters.detail import router as detail_router
from app.api.v3.parameters.list import router as list_router

router = APIRouter(prefix="/parameters", tags=["parameters"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)

# Note: Additional endpoints (detail-default, create, update, duplicate, delete, items/create) will be added

