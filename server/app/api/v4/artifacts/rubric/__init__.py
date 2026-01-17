"""{artifact.title()} v4 router."""

from app.api.v4.artifacts.rubric.delete import router as delete_router
from app.api.v4.artifacts.rubric.draft import router as draft_router
from app.api.v4.artifacts.rubric.duplicate import router as duplicate_router
from app.api.v4.artifacts.rubric.get import router as get_router
from app.api.v4.artifacts.rubric.list import router as list_router
from app.api.v4.artifacts.rubric.save import router as save_router
from fastapi import APIRouter

router = APIRouter(prefix="/rubrics", tags=["rubrics"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(draft_router)
