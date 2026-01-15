"""{artifact.title()} v4 router."""

from fastapi import APIRouter

from app.api.v4.artifacts.auth.get import router as get_router
from app.api.v4.artifacts.auth.list import router as list_router
from app.api.v4.artifacts.auth.save import router as save_router
from app.api.v4.artifacts.auth.duplicate import router as duplicate_router
from app.api.v4.artifacts.auth.delete import router as delete_router
from app.api.v4.artifacts.auth.login import router as login_router

router = APIRouter(prefix="/auths", tags=["auths"])

# Include all endpoint routers
router.include_router(get_router)
router.include_router(list_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(login_router)
