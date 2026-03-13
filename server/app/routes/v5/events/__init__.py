"""Centralized event delivery — SSE stream + schema."""

from __future__ import annotations

from fastapi import APIRouter

_router: APIRouter | None = None


def get_router() -> APIRouter:
    """Build the events router lazily to avoid package import cycles."""
    global _router
    if _router is not None:
        return _router

    from app.routes.v5.events.schema import schema_router
    from app.routes.v5.events.stream import router as stream_router

    router = APIRouter(prefix="/stream", tags=["stream"])
    router.include_router(stream_router)
    router.include_router(schema_router)
    _router = router
    return router
