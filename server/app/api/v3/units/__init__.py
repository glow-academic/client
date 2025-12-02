"""Units resource router."""

from fastapi import APIRouter

from app.api.v3.units.list import router as list_router

router = APIRouter(prefix="/units", tags=["units"])

# Include endpoint routers
router.include_router(list_router)

