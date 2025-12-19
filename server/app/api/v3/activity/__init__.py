"""Activity resource router."""

from fastapi import APIRouter

from app.api.v3.activity.bundle import router as bundle_router
from app.api.v3.activity.list import router as list_router

router = APIRouter(prefix="/activity", tags=["activity"])

# Include endpoint routers
router.include_router(bundle_router)
router.include_router(list_router)
