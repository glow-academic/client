"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.api.v4.artifacts.parameter.get import router as get_router
from app.api.v4.artifacts.parameter.list import router as list_router
from app.api.v4.artifacts.parameter.save import router as save_router
from app.api.v4.artifacts.parameter.duplicate import router as duplicate_router
from app.api.v4.artifacts.parameter.delete import router as delete_router

router = APIRouter(prefix="/parameters", tags=["parameters"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
