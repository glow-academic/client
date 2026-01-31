"""NEW Analytics v4 API resource router.

This router provides MV-based analytics endpoints that query materialized views
directly with JOINs to _resource tables for metadata. No SQL functions are used.

Structure:
- /NEW/home - Home section analytics (overview, history, refresh)
- /NEW/practice - (Future) Practice section analytics
- /NEW/dashboard - (Future) Dashboard section analytics
- /NEW/reports - (Future) Reports section analytics
- /NEW/pricing - (Future) Pricing section analytics
- /NEW/activity - (Future) Activity section analytics
- /NEW/health - (Future) Health section analytics
- /NEW/benchmark - (Future) Benchmark section analytics
"""

from fastapi import APIRouter

from app.api.v4.analytics.NEW.home import router as home_router
from app.api.v4.analytics.NEW.practice import router as practice_router

router = APIRouter(prefix="/NEW", tags=["analytics", "new"])

# Include section routers
router.include_router(home_router)
router.include_router(practice_router)

# Future sections (uncomment as implemented):
# from app.api.v4.analytics.NEW.dashboard import router as dashboard_router
# from app.api.v4.analytics.NEW.reports import router as reports_router
# from app.api.v4.analytics.NEW.pricing import router as pricing_router
# from app.api.v4.analytics.NEW.activity import router as activity_router
# from app.api.v4.analytics.NEW.health import router as health_router
# from app.api.v4.analytics.NEW.benchmark import router as benchmark_router

# router.include_router(dashboard_router)
# router.include_router(reports_router)
# router.include_router(pricing_router)
# router.include_router(activity_router)
# router.include_router(health_router)
# router.include_router(benchmark_router)
