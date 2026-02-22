"""Views API router - READ layer on top of entry_type tables.

All view endpoints have been migrated to the entries layer.
Only the drafts internal module remains (no HTTP routes).
"""

from fastapi import APIRouter

router = APIRouter(prefix="/views", tags=["views"])
