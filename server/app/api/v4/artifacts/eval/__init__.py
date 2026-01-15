"""Eval v4 router."""

from app.api.v4.artifacts.eval.delete import router as delete_router
from app.api.v4.artifacts.eval.draft import router as draft_router
from app.api.v4.artifacts.eval.duplicate import router as duplicate_router
from app.api.v4.artifacts.eval.get import router as get_router
from app.api.v4.artifacts.eval.list import router as list_router
from app.api.v4.artifacts.eval.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/evals", tags=["evals"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
