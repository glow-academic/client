"""Runs API endpoints."""

from fastapi import APIRouter

from app.api.v3.runs import full

router = APIRouter(tags=["runs", "v3"])

router.include_router(full.router)
