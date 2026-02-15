"""Views API router - READ layer on top of entry_type tables.

Views aggregate entries and expose resources for developer templates.
This consolidates home/practice/dashboard/reports into unified views with filter parameters.
"""

from fastapi import APIRouter

from app.api.v4.views.activity import router as activity_router
from app.api.v4.views.analytics import router as analytics_router
from app.api.v4.views.attempt import router as attempt_router
from app.api.v4.views.audit import router as audit_router
from app.api.v4.views.benchmark import router as benchmark_router
from app.api.v4.views.call import router as call_router
from app.api.v4.views.config import router as config_router
from app.api.v4.views.group import router as group_router
from app.api.v4.views.health import router as health_router
from app.api.v4.views.login import router as login_router
from app.api.v4.views.message import router as message_router
from app.api.v4.views.metric import router as metric_router
from app.api.v4.views.problem import router as problem_router
from app.api.v4.views.run import router as run_router
from app.api.v4.views.session import router as session_router
from app.api.v4.views.training import router as training_router

router = APIRouter(prefix="/views", tags=["views"])

router.include_router(attempt_router)
router.include_router(activity_router)
router.include_router(health_router)
router.include_router(benchmark_router)
router.include_router(config_router)
router.include_router(training_router)
router.include_router(session_router)
router.include_router(group_router)
router.include_router(audit_router)
router.include_router(run_router)
router.include_router(message_router)
router.include_router(call_router)
router.include_router(problem_router)
router.include_router(login_router)
router.include_router(metric_router)
router.include_router(analytics_router)
