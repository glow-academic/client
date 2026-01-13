"""Auth resource router."""

from fastapi import APIRouter

from app.api.v4.auth.delete import router as delete_router
from app.api.v4.auth.duplicate import router as duplicate_router
from app.api.v4.auth.get import router as get_router
from app.api.v4.auth.list import router as list_router
from app.api.v4.auth.login import router as login_router
from app.api.v4.auth.save import router as save_router

router = APIRouter(prefix="/auth", tags=["auth"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(get_router)
router.include_router(save_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(login_router)
