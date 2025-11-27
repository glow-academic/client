"""Auth resource router."""

from fastapi import APIRouter

from app.api.v3.auth.create import router as create_router
from app.api.v3.auth.delete import router as delete_router
from app.api.v3.auth.detail import router as detail_router
from app.api.v3.auth.new import router as new_router
from app.api.v3.auth.duplicate import router as duplicate_router
from app.api.v3.auth.list import router as list_router
from app.api.v3.auth.login import router as login_router
from app.api.v3.auth.update import router as update_router

router = APIRouter(prefix="/auth", tags=["auth"])

# Include endpoint routers
router.include_router(list_router)
router.include_router(detail_router)
router.include_router(new_router)
router.include_router(create_router)
router.include_router(update_router)
router.include_router(duplicate_router)
router.include_router(delete_router)
router.include_router(login_router)

