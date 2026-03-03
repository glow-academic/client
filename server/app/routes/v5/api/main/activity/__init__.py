"""Activity artifact router."""

from fastapi import APIRouter

from app.routes.v5.api.main.activity.docs import router as docs_router
from app.routes.v5.api.main.activity.get import router as get_router
from app.routes.v5.api.main.activity.problem import router as problem_router
from app.routes.v5.api.main.activity.refresh import router as refresh_router
from app.routes.v5.api.main.activity.resolve import router as resolve_router

router = APIRouter(prefix="/activity", tags=["activity"])
router.include_router(get_router)
router.include_router(problem_router)
router.include_router(refresh_router)
router.include_router(resolve_router)
router.include_router(docs_router)
