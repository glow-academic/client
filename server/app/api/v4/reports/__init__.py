"""Reports v4 API resource router."""

from app.api.v4.reports.bundle import router
from app.api.v4.reports.history import router as history_router
from app.api.v4.reports.overview import router as overview_router

# Include all routers in the main router
router.include_router(overview_router)
router.include_router(history_router)

__all__ = ["router"]
