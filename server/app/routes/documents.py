# app/routes/documents.py
import os
import uuid
import json
import shutil
import logging
from fastapi import (
    APIRouter,
    Request,
    Response,
    Form,
    HTTPException,
    Depends,
    UploadFile,
    File,
)
from fastapi.responses import JSONResponse, FileResponse
from sqlmodel import Session, select
from app.models import Documents
from app.db import get_session
from app.extensions import UPLOAD_FOLDER
import mimetypes

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(UPLOAD_FOLDER, "tus_uploads")
os.makedirs(TUS_UPLOADS_DIR, exist_ok=True)

logger = logging.getLogger(__name__)
router = APIRouter()


# Regular file upload endpoint (alternative to TUS for simple uploads)
@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    profile: str = Form(...),
    class_id: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    Upload a document using regular multipart form data
    """
    # Validate profile
    if profile not in ["aggressive", "happy", "confused"]:
        raise HTTPException(status_code=400, detail="Invalid profile type")

    # Generate a unique ID for the document
    document_id = str(uuid.uuid4())

    # Get file extension from filename
    _, ext = os.path.splitext(file.filename)
    if not ext:
        ext = ".bin"  # Default extension if none is provided

    # Create the file path
    file_path = f"{document_id}{ext}"
    full_path = os.path.join(UPLOAD_FOLDER, file_path)

    # Save the file
    with open(full_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Create document record in database
    document = Documents(
        id=document_id,
        name=file.filename,
        file_path=file_path,
        mime_type=file.content_type,
        profile=profile,
        class_id=class_id,
    )

    session.add(document)
    session.commit()

    return {"message": "Document uploaded successfully", "document_id": document_id}


# Get document by ID
@router.get("/id/{document_id}")
async def get_document(
    document_id: str,
    session: Session = Depends(get_session),
):
    """
    Retrieve a document by its ID
    """
    # Query the document
    query = select(Documents).where(Documents.id == document_id)
    result = session.exec(query).first()

    if not result:
        raise HTTPException(status_code=404, detail="Document not found")

    # Construct the full file path
    file_path = os.path.join(UPLOAD_FOLDER, result.file_path)

    # Check if file exists
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Document file not found")

    # Return the file as a response
    return FileResponse(
        path=file_path, filename=result.name, media_type=result.mime_type
    )


# TUS Protocol Implementation
@router.options("/tus")
async def tus_options(request: Request):
    """Handle OPTIONS request for tus protocol"""
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


@router.post("/tus")
async def tus_creation(request: Request):
    """Handle POST request for tus protocol - create upload"""
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
                import base64

                metadata[k] = base64.b64decode(v).decode("utf-8")

    # Generate upload ID
    upload_id = str(uuid.uuid4())

    # Create upload directory
    upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)
    os.makedirs(upload_dir, exist_ok=True)

    # Save metadata
    with open(os.path.join(upload_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f)

    # Create empty file
    with open(os.path.join(upload_dir, "file"), "wb") as f:
        pass

    # Save upload info
    with open(os.path.join(upload_dir, "info"), "w") as f:
        f.write(f"length:{upload_length}\noffset:0")

    # Get base URL from request
    forwarded_proto = request.headers.get("X-Forwarded-Proto", "http")
    forwarded_host = request.headers.get(
        "X-Forwarded-Host", request.headers.get("Host", "localhost:8000")
    )
    base_url = f"{forwarded_proto}://{forwarded_host}"

    location = f"{base_url}/documents/tus/{upload_id}"

    # Handle creation-with-upload if Content-Length > 0
    if request.headers.get("Content-Length", "0") != "0":
        # Read the first chunk
        chunk = await request.body()

        # Write to file
        with open(os.path.join(upload_dir, "file"), "wb") as f:
            f.write(chunk)

        # Update offset
        offset = len(chunk)
        with open(os.path.join(upload_dir, "info"), "w") as f:
            f.write(f"length:{upload_length}\noffset:{offset}")

        return Response(
            status_code=201,
            headers={
                "Location": location,
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": str(offset),
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


@router.head("/tus/{upload_id}")
async def tus_head(upload_id: str, request: Request):
    """Handle HEAD request for tus protocol - get upload info"""
    upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)

    if not os.path.exists(upload_dir):
        return Response(status_code=404)

    # Read info file
    with open(os.path.join(upload_dir, "info"), "r") as f:
        info = {}
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


@router.patch("/tus/{upload_id}")
async def tus_patch(upload_id: str, request: Request):
    """Handle PATCH request for tus protocol - upload chunk"""
    upload_dir = os.path.join(TUS_UPLOADS_DIR, upload_id)

    if not os.path.exists(upload_dir):
        return Response(status_code=404)

    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Check content type
    if request.headers.get("Content-Type") != "application/offset+octet-stream":
        return Response(status_code=415)

    # Read info file
    with open(os.path.join(upload_dir, "info"), "r") as f:
        info = {}
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v

    # Check offset
    if request.headers.get("Upload-Offset") != info.get("offset"):
        return Response(status_code=409)

    # Read chunk
    chunk = await request.body()

    # Append to file
    with open(os.path.join(upload_dir, "file"), "ab") as f:
        f.write(chunk)

    # Update offset
    new_offset = int(info.get("offset", "0")) + len(chunk)
    with open(os.path.join(upload_dir, "info"), "w") as f:
        f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": str(new_offset),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        }
    )


@router.options("/tus/{upload_id}")
async def tus_options_upload_id(upload_id: str, request: Request):
    """Handle OPTIONS request for specific upload"""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.post("/tus/finalize")
async def finalize_upload(request: Request, session: Session = Depends(get_session)):
    """Finalize an upload and process the file"""
    try:
        # Parse request body
        body = await request.json()
        file_id = body.get("fileId")
        profile = body.get("profile")

        if not file_id:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Missing fileId parameter"},
            )

        if not profile:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Missing profile parameter"},
            )

        # Validate profile
        if profile not in ["aggressive", "happy", "confused"]:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Invalid profile type"},
            )

        # Find the upload directory
        upload_dir = None
        for dir_name in os.listdir(TUS_UPLOADS_DIR):
            metadata_path = os.path.join(TUS_UPLOADS_DIR, dir_name, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path, "r") as f:
                    metadata = json.load(f)
                    if metadata.get("fileId") == file_id:
                        upload_dir = os.path.join(TUS_UPLOADS_DIR, dir_name)
                        break

        if not upload_dir:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "message": f"Upload with fileId {file_id} not found",
                },
            )

        # Get the uploaded file path
        file_path = os.path.join(upload_dir, "file")

        # Check if file exists and has content
        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "message": "Upload file is missing or empty",
                },
            )

        # Read metadata
        with open(os.path.join(upload_dir, "metadata.json"), "r") as f:
            metadata = json.load(f)

        # Extract filename from metadata
        filename = metadata.get("filename", f"file-{file_id}")

        # Determine file extension
        _, ext = os.path.splitext(filename)
        if not ext:
            # Try to detect MIME type and assign extension
            mime_type = metadata.get("filetype", "application/octet-stream")
            ext = mimetypes.guess_extension(mime_type) or ".bin"

        # Generate document ID
        document_id = str(uuid.uuid4())

        # Create final file path
        final_file_path = f"{document_id}{ext}"
        final_full_path = os.path.join(UPLOAD_FOLDER, final_file_path)

        # Move the file to its final location
        shutil.copy2(file_path, final_full_path)

        # Create document record in database
        document = Documents(
            id=document_id,
            name=filename,
            file_path=final_file_path,
            mime_type=metadata.get("filetype", "application/octet-stream"),
            profile=profile,
        )

        session.add(document)
        session.commit()

        # Clean up the TUS upload directory
        try:
            shutil.rmtree(upload_dir)
            logger.info(f"Cleaned up TUS upload directory: {upload_dir}")
        except Exception as cleanup_error:
            logger.warning(
                f"Failed to clean up TUS upload directory: {str(cleanup_error)}"
            )

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Document uploaded successfully",
                "document_id": document_id,
            },
        )

    except Exception as e:
        logger.error(f"Error finalizing upload: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())

        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Failed to process file: {str(e)}"},
        )


@router.delete("/id/{document_id}")
async def delete_document(
    document_id: str,
    session: Session = Depends(get_session),
):
    """
    Delete a document by its ID - removes both database entry and file from filesystem
    """
    try:
        # Query the document
        query = select(Documents).where(Documents.id == document_id)
        document = session.exec(query).first()

        if not document:
            return JSONResponse(
                status_code=404,
                content={
                    "status": "error",
                    "message": f"Document with ID {document_id} not found",
                },
            )

        # Get the file path and ensure it's the full path
        db_file_path = document.file_path
        upload_folder_str = str(UPLOAD_FOLDER)

        # If the path doesn't start with the UPLOAD_FOLDER, prepend it
        full_file_path = db_file_path
        if not str(db_file_path).startswith(upload_folder_str):
            full_file_path = os.path.join(upload_folder_str, db_file_path)

        logger.info(f"Attempting to delete file: {full_file_path}")

        # Delete the file from the filesystem if it exists
        if os.path.exists(full_file_path):
            try:
                os.remove(full_file_path)
                logger.info(f"Deleted file from filesystem: {full_file_path}")
            except Exception as e:
                logger.error(f"Error deleting file {full_file_path}: {str(e)}")
        else:
            logger.warning(f"File not found in filesystem: {full_file_path}")

        # Delete the document from the database
        session.delete(document)
        session.commit()

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": f"Document {document_id} deleted successfully",
            },
        )

    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())

        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Failed to delete document: {str(e)}",
            },
        )
