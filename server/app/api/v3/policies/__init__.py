"""Policies API router."""

from fastapi import APIRouter

from app.api.v3.policies import (
    create,
    delete,
    detail,
    list,
    update,
)

router = APIRouter(prefix="/policies", tags=["policies"])

router.include_router(create.router)
router.include_router(list.router)
router.include_router(detail.router)
router.include_router(update.router)
router.include_router(delete.router)
