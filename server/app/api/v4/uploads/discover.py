"""TUS protocol discovery — OPTIONS endpoint."""

from fastapi import APIRouter, Request, Response

router = APIRouter()

TUS_HEADERS = {
    "Tus-Resumable": "1.0.0",
    "Tus-Version": "1.0.0",
    "Tus-Extension": "creation,termination,creation-with-upload",
    "Tus-Max-Size": "1073741824",  # 1GB
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
    "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
    "Access-Control-Max-Age": "86400",
}


@router.options("/discover")
async def tus_discover(request: Request) -> Response:
    """TUS protocol discovery."""
    return Response(headers=TUS_HEADERS)


@router.options("/discover/{upload_id}")
async def tus_discover_upload(upload_id: str, request: Request) -> Response:
    """TUS protocol discovery for a specific upload."""
    return Response(headers=TUS_HEADERS)
