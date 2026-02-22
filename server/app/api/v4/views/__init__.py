"""Views API router - READ layer on top of entry_type tables.

Views aggregate entries and expose resources for developer templates.
Most view endpoints have been migrated to the entries layer.
Only message views remain here due to cross-artifact dependencies.
"""

from fastapi import APIRouter

from app.api.v4.views.message import router as message_router

router = APIRouter(prefix="/views", tags=["views"])

router.include_router(message_router)
