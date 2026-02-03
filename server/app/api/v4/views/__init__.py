"""Views API router - READ layer on top of entry_type tables.

Views aggregate entries and expose resources for developer templates.
This consolidates home/practice/dashboard/reports into unified views with filter parameters.
"""

from fastapi import APIRouter

from app.api.v4.views.analytics import router as analytics_router
from app.api.v4.views.simulation import router as simulation_router

router = APIRouter(prefix="/views", tags=["views"])

router.include_router(simulation_router)
router.include_router(analytics_router)
