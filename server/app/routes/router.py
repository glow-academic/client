"""Root router — collects all top-level route modules."""

from fastapi import APIRouter

from app.routes.default_idp import router as default_idp_router
from app.routes.health import router as health_router
from app.routes.root_info import router as root_info_router
from app.routes.v5.router import router as v5_router
from app.routes.well_known import router as well_known_router

router = APIRouter()

router.include_router(v5_router)
router.include_router(default_idp_router)
router.include_router(health_router)
router.include_router(well_known_router)
router.include_router(root_info_router)
