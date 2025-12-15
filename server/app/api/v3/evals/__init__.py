"""Evals v3 router."""

from fastapi import APIRouter

from app.api.v3.evals.create import router as create_router
from app.api.v3.evals.delete import router as delete_router
from app.api.v3.evals.detail import router as detail_router
from app.api.v3.evals.list import router as list_router
from app.api.v3.evals.model_runs import router as model_runs_router
from app.api.v3.evals.new import router as new_router
from app.api.v3.evals.run import router as run_router
from app.api.v3.evals.stop import router as stop_router
from app.api.v3.evals.update import router as update_router

router = APIRouter(prefix="/evals", tags=["evals"])

# Include all eval endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(delete_router)
router.include_router(model_runs_router)
router.include_router(run_router)
router.include_router(stop_router)
