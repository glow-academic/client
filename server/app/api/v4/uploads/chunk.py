"""TUS chunk upload — PATCH endpoint."""

from fastapi import APIRouter, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.main import TUS_UPLOADS_DIR

router = APIRouter()


@router.patch(
    "/{upload_id}/chunk",
    dependencies=[
        audit_activity(
            "upload.patched", "{{ actor.name }} patched upload '{{ upload.id }}'"
        )
    ],
)
async def tus_chunk(upload_id: str, request: Request) -> Response:
    """Append a chunk to an in-progress upload."""
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    if request.headers.get("Content-Type") != "application/offset+octet-stream":
        return Response(status_code=415)

    expected_offset = request.headers.get("Upload-Offset")
    if not expected_offset:
        return Response(status_code=400, content="Missing Upload-Offset header")

    chunk = await request.body()

    upload_dir = TUS_UPLOADS_DIR / upload_id

    if not upload_dir.exists():
        return Response(status_code=404)

    info = {}
    with open(upload_dir / "info") as f:
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v

    if expected_offset != info.get("offset"):
        return Response(status_code=409)

    with open(upload_dir / "file", "ab") as f:
        f.write(chunk)

    new_offset = int(info.get("offset", "0")) + len(chunk)
    with open(upload_dir / "info", "w") as f:
        f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

    profile_id = (
        getattr(request.state, "profile_id", None)
        if hasattr(request.state, "profile_id")
        else None
    )
    if profile_id:
        audit_set(request, actor={"id": profile_id}, upload={"id": upload_id})

    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": str(new_offset),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        }
    )
