"""Schema changed endpoint — expires all DB connections."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.infra.globals import expire_all_connections

router = APIRouter()


@router.post("/schema-changed")
async def schema_changed() -> JSONResponse:
    await expire_all_connections()
    return JSONResponse(content={"success": True})
