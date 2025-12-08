"""TUS OPTIONS endpoint - v3 API following DHH principles."""

from fastapi import APIRouter, Request, Response

router = APIRouter()


@router.options("/upload")
async def tus_options(request: Request) -> Response:
    """Handle OPTIONS request for tus protocol discovery."""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload",
            "Tus-Max-Size": "1073741824",  # 1GB max file size
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.options("/upload/{upload_id}")
async def tus_options_upload_id(upload_id: str, request: Request) -> Response:
    """Handle OPTIONS request for specific upload."""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )
