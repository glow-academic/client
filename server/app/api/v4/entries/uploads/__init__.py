"""Uploads entry endpoints — dual MCP/non-MCP interface.

MCP class:
  POST /uploads/get        — Returns metadata from uploads_mv
  POST /uploads/create/mcp — Accepts base64 data inline

Non-MCP class:
  POST /uploads/get          — Returns metadata (use download for file content)
  POST /uploads/create       — Creates entry record
  GET  /uploads/download/{id} — Streams file content
  POST /uploads/search       — Search uploads

TUS protocol (non-MCP, separate):
  OPTIONS /uploads/tus           — TUS discovery
  POST    /uploads/tus           — Create TUS upload
  HEAD    /uploads/tus/{id}      — Get upload progress
  PATCH   /uploads/tus/{id}      — Upload chunk
  POST    /uploads/tus/{id}/finalize — Finalize and create record
"""

from fastapi import APIRouter

from app.api.v4.entries.uploads.create import router as create_router
from app.api.v4.entries.uploads.get import router as get_router
from app.api.v4.entries.uploads.search import router as search_router
from app.api.v4.entries.uploads.tus import router as tus_router

router = APIRouter()
router.include_router(get_router)
router.include_router(create_router)
router.include_router(search_router)
router.include_router(tus_router)
