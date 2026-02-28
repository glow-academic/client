"""Cohort v4 router."""

from fastapi import APIRouter

from app.api.v4.artifacts.cohort.delete import router as delete_router
from app.api.v4.artifacts.cohort.docs import router as docs_router
from app.api.v4.artifacts.cohort.draft import router as draft_router
from app.api.v4.artifacts.cohort.duplicate import router as duplicate_router
from app.api.v4.artifacts.cohort.export import router as export_router
from app.api.v4.artifacts.cohort.get import router as get_router
from app.api.v4.artifacts.cohort.list import router as list_router
from app.api.v4.artifacts.cohort.save import router as save_router

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
