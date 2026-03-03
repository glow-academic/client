"""Eval v4 router."""

from fastapi import APIRouter

from app.v5.api.main.eval.delete import router as delete_router
from app.v5.api.main.eval.docs import router as docs_router
from app.v5.api.main.eval.draft import router as draft_router
from app.v5.api.main.eval.duplicate import router as duplicate_router
from app.v5.api.main.eval.get import router as get_router
from app.v5.api.main.eval.list import router as list_router
from app.v5.api.main.eval.save import router as save_router

router = APIRouter(prefix="/evals", tags=["evals"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)
