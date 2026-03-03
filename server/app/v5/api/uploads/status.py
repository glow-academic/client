"""TUS upload status — HEAD endpoint."""

from fastapi import APIRouter, Request, Response

from app.v5.infra.globals import TUS_UPLOADS_DIR

router = APIRouter()


@router.head("/{upload_id}/status")
async def tus_status(upload_id: str, request: Request) -> Response:
    """Get current upload offset and length."""
    upload_dir = TUS_UPLOADS_DIR / upload_id

    if not upload_dir.exists():
        return Response(status_code=404)

    info = {}
    with open(upload_dir / "info") as f:
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v

    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": info.get("offset", "0"),
            "Upload-Length": info.get("length", "0"),
            "Cache-Control": "no-store",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        }
    )
