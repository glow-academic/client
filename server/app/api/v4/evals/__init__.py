"""Evals v4 router."""

from fastapi import APIRouter

router = APIRouter(prefix="/evals", tags=["evals"])

# Include all eval endpoint routers (skip routes with missing types)
try:
    from app.api.v4.evals.create import router as create_router

    router.include_router(create_router)
except ImportError:
    pass

try:
    from app.api.v4.evals.delete import router as delete_router

    router.include_router(delete_router)
except ImportError:
    pass

try:
    from app.api.v4.evals.detail import router as detail_router

    router.include_router(detail_router)
except ImportError:
    pass

try:
    from app.api.v4.evals.list import router as list_router

    router.include_router(list_router)
except ImportError:
    pass

try:
    from app.api.v4.evals.new import router as new_router

    router.include_router(new_router)
except ImportError:
    pass

try:
    from app.api.v4.evals.update import router as update_router

    router.include_router(update_router)
except ImportError:
    pass

try:
    from app.api.v4.evals.get import router as get_router

    router.include_router(get_router)
except ImportError:
    pass

try:
    from app.api.v4.evals.save import router as save_router

    router.include_router(save_router)
except ImportError:
    pass
