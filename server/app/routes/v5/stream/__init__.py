"""Stream delivery — GET /v5/stream (SSE) + POST /v5/stream/{Type} (schema)."""

from __future__ import annotations

from fastapi import APIRouter

_router: APIRouter | None = None


def get_router() -> APIRouter:
    """Build the stream router lazily to avoid package import cycles."""
    global _router
    if _router is not None:
        return _router

    from app.routes.v5.stream.schema import schema_router
    from app.routes.v5.stream.sse import router as sse_router

    router = APIRouter(prefix="/stream", tags=["stream"])
    router.include_router(sse_router)
    router.include_router(schema_router)
    _router = router
    return router
