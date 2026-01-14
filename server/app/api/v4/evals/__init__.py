"""Evals v4 router."""

from app.api.v4.evals.delete import router as delete_router
from app.api.v4.evals.get import router as get_router
from app.api.v4.evals.list import router as list_router
from app.api.v4.evals.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/evals", tags=["evals"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(delete_router)
