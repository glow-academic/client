"""Root router — collects all top-level route modules."""

import platform
import sys

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.routes.default_idp import router as default_idp_router
from app.routes.health import router as health_router
from app.routes.v5 import router as v5_router
from app.routes.well_known import router as well_known_router

router = APIRouter()

router.include_router(v5_router)
router.include_router(default_idp_router)
router.include_router(health_router)
router.include_router(well_known_router)


@router.get("/")
async def root_info() -> JSONResponse:
    info = {
        "python_version": sys.version.split()[0],
        "platform": platform.system(),
        "platform_release": platform.release(),
        "fastapi_version": getattr(
            sys.modules.get("fastapi"), "__version__", "unknown"
        ),
    }
    return JSONResponse(content={"server_info": info})
