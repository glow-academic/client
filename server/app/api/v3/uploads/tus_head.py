"""TUS HEAD endpoint - v3 API following DHH principles."""

from fastapi import APIRouter, Request, Response

from app.main import TUS_UPLOADS_DIR

router = APIRouter()


@router.head("/upload/{upload_id}")
async def tus_head(upload_id: str, request: Request) -> Response:
    """Handle HEAD request for tus protocol - get upload info."""
    upload_dir = TUS_UPLOADS_DIR / upload_id

    if not upload_dir.exists():
        return Response(status_code=404)

    # Read info file
    info = {}
    with open(upload_dir / "info") as f:
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v

    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": info.get("offset", "0"),
        "Upload-Length": info.get("length", "0"),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
    }

    return Response(headers=headers)

