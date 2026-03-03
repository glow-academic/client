"""Cohort v4 router."""

from fastapi import APIRouter

from app.v5.api.main.cohort.delete import router as delete_router
from app.v5.api.main.cohort.docs import router as docs_router
from app.v5.api.main.cohort.draft import router as draft_router
from app.v5.api.main.cohort.duplicate import router as duplicate_router
from app.v5.api.main.cohort.export import router as export_router
from app.v5.api.main.cohort.get import router as get_router
from app.v5.api.main.cohort.list import router as list_router
from app.v5.api.main.cohort.save import router as save_router

router = APIRouter(prefix="/cohorts", tags=["cohorts"])

# Include all endpoint routers (standard 6 endpoints)
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(export_router)
router.include_router(docs_router)
