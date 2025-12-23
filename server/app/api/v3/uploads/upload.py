"""TUS POST endpoint - v3 API following DHH principles."""

import base64
import json
import os
import uuid

from fastapi import APIRouter, Request, Response

from app.main import TUS_UPLOADS_DIR
from app.infra.activity.audit import audit_activity, audit_set

router = APIRouter()


@router.post(
    "/upload",
    dependencies=[audit_activity("upload.uploaded", "{{ actor.name }} uploaded file")],
)
async def tus_creation(request: Request) -> Response:
    """Handle POST request for tus protocol - create upload."""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Get upload length
    upload_length = request.headers.get("Upload-Length")
    if not upload_length:
        return Response(status_code=400, content="Missing Upload-Length header")

    # Parse metadata
    metadata = {}
    if "Upload-Metadata" in request.headers:
        for kv in request.headers["Upload-Metadata"].split(","):
            if " " in kv:
                k, v = kv.strip().split(" ", 1)
                metadata[k] = base64.b64decode(v).decode("utf-8")

    # Get app prefix from environment
    app_prefix = os.getenv("APP_PREFIX", "").strip("/")

    # Create upload directory and files
    upload_id = str(uuid.uuid4())
    upload_dir = TUS_UPLOADS_DIR / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save metadata
    with open(upload_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)

    # Create empty file
    with open(upload_dir / "file", "wb") as f:
        pass

    # Save upload info
    with open(upload_dir / "info", "w") as f:
        f.write(f"length:{upload_length}\noffset:0")

    # Generate location path
    if app_prefix:
        location = f"/{app_prefix}/api/v3/uploads/upload/{upload_id}"
    else:
        location = f"/api/v3/uploads/upload/{upload_id}"

    # Set audit context if profile_id is available
    profile_id = (
        getattr(request.state, "profile_id", None)
        if hasattr(request.state, "profile_id")
        else None
    )
    if profile_id:
        # Note: We can't fetch actor_name here without database access
        # Activity logging will use profile_id only
        audit_set(request, actor={"id": profile_id}, upload={"id": upload_id})

    # Handle creation-with-upload if Content-Length > 0
    if request.headers.get("Content-Length", "0") != "0":
        chunk = await request.body()

        # Read current info
        info = {}
        with open(upload_dir / "info") as f:
            for line in f:
                k, v = line.strip().split(":", 1)
                info[k] = v

        # Append chunk to file
        with open(upload_dir / "file", "ab") as f:
            f.write(chunk)

        # Update offset
        new_offset = int(info.get("offset", "0")) + len(chunk)
        with open(upload_dir / "info", "w") as f:
            f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

        return Response(
            status_code=201,
            headers={
                "Location": location,
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": str(new_offset),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            },
        )

    return Response(
        status_code=201,
        headers={
            "Location": location,
            "Tus-Resumable": "1.0.0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        },
    )
