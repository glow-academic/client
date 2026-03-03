"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.v5.api.main.rubric.delete import router as delete_router
from app.v5.api.main.rubric.docs import router as docs_router
from app.v5.api.main.rubric.draft import router as draft_router
from app.v5.api.main.rubric.duplicate import router as duplicate_router
from app.v5.api.main.rubric.get import router as get_router
from app.v5.api.main.rubric.list import router as list_router
from app.v5.api.main.rubric.save import router as save_router

router = APIRouter(prefix="/rubrics", tags=["rubrics"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
router.include_router(docs_router)
