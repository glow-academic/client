"""Policies API router."""

from fastapi import APIRouter

from app.api.v3.policies import (
    create,
    delete,
    detail,
    download,
    list,
    update,
    upload_finalize,
)

router = APIRouter(prefix="/policies", tags=["policies"])

router.include_router(create.router)
router.include_router(list.router)
router.include_router(detail.router)
router.include_router(update.router)
router.include_router(delete.router)
router.include_router(upload_finalize.router)
router.include_router(download.router)
