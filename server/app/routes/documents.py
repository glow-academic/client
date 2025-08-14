# app/routes/document.py
import json
import logging
import mimetypes
import os
import shutil
import subprocess
import tempfile
import uuid
import zipfile
from uuid import UUID

from app.db import get_session
from app.extensions import UPLOAD_FOLDER
from app.models import Documents
from app.services.agents.collection.classify import run_classify_agent
from app.utils.mime_utils import get_content_type
from dotenv import load_dotenv
from fastapi import (APIRouter, Depends, File, HTTPException, Request,
                     Response, UploadFile)
from fastapi.responses import FileResponse, JSONResponse
from reportlab.graphics.shapes import Drawing, Rect  # type: ignore
from sqlmodel import Session, select

load_dotenv()

# Create uploads directory if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(UPLOAD_FOLDER, "tus_uploads")
os.makedirs(TUS_UPLOADS_DIR, exist_ok=True)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health")
async def documents_health_check() -> JSONResponse:
    """
    Health check endpoint for documents service
    """
    try:
        # Check if upload folder exists and is writable
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        # Check if TUS uploads directory exists and is writable
        if not os.path.exists(TUS_UPLOADS_DIR):
            os.makedirs(TUS_UPLOADS_DIR, exist_ok=True)

        return JSONResponse(
            status_code=200,
            content={
                "status": "ok",
                "service": "documents",
                "upload_folder": str(UPLOAD_FOLDER),
                "tus_uploads_dir": str(TUS_UPLOADS_DIR),
            },
        )
    except Exception as e:
        logger.error(f"Documents health check failed: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "service": "documents", "error": str(e)},
        )

# Regular file upload endpoint (alternative to TUS for simple uploads)
@router.post("/upload")
async def upload_document(
    files: list[UploadFile] = File(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Upload one or more documents using regular multipart form data
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    uploaded_documents = []

    for file in files:
        # Generate a unique ID for the document
        document_id = uuid.uuid4()

        # Get file extension from filename
        _, ext = os.path.splitext(file.filename or "")
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
        )

        session.add(document)
        uploaded_documents.append(
            {
                "document_id": str(document_id),
                "name": file.filename,
                "mime_type": file.content_type,
            }
        )

    session.commit()

    return JSONResponse(
        status_code=200,
        content={
            "status": "success",
            "message": f"Successfully uploaded {len(uploaded_documents)} document(s)",
            "documents": uploaded_documents,
            "count": len(uploaded_documents),
        },
    )


# Get document by ID
@router.get("/id/{document_id}")
async def get_document(
    document_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> FileResponse:
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

    # Get the best content type for this file
    content_type = get_content_type(result.name, result.mime_type)
    
    # Properly encode filename for HTTP headers to handle Unicode characters
    import urllib.parse
    encoded_filename = urllib.parse.quote(result.name, safe='')
    content_disposition = f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"
    
    # Return the file as a response with proper content type
    return FileResponse(
        path=file_path, 
        filename=result.name, 
        media_type=content_type,
        headers={
            "Content-Disposition": content_disposition,
            "Cache-Control": "private, max-age=0, must-revalidate",
        }
    )


# TUS Protocol Implementation
@router.options("/tus")
async def tus_options(request: Request) -> Response:
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
async def tus_creation(request: Request) -> Response:
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
    upload_id = uuid.uuid4()

    # Create upload directory
    upload_dir = os.path.join(TUS_UPLOADS_DIR, str(upload_id))
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

    # Use the Next.js proxy endpoint for TUS uploads
    # Include app prefix if it exists
    app_prefix = os.getenv("APP_PREFIX", "").strip("/")
    if app_prefix:
        location = f"/{app_prefix}/api/upload/{upload_id}"
    else:
        location = f"/api/upload/{upload_id}"

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
async def tus_head(upload_id: str, request: Request) -> Response:
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
async def tus_patch(upload_id: str, request: Request) -> Response:
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
async def tus_options_upload_id(upload_id: str, request: Request) -> Response:
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
async def finalize_upload(
    request: Request, session: Session = Depends(get_session)
) -> JSONResponse:
    """Finalize an upload and process the file"""
    try:
        # Parse request body
        body = await request.json()
        file_id = body.get("fileId")
        is_csv = body.get("csv", False)
        test = body.get("test", False)
        profile_id = body.get("profile_id")

        if not file_id:
            return JSONResponse(
                status_code=400,
                content={"status": "error", "message": "Missing fileId parameter"},
            )

        # Handle CSV uploads differently
        if is_csv:
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
                        "message": f"Upload with fileId {str(file_id)} not found",
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

            # Process CSV file
            try:
                from app.utils.csv import process_csv_file

                result = process_csv_file(file_path, session)

                # Clean up the TUS upload directory
                try:
                    shutil.rmtree(upload_dir)
                    logger.info(f"Cleaned up TUS upload directory: {upload_dir}")
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to clean up TUS upload directory: {str(cleanup_error)}"
                    )

                if result["success"]:
                    return JSONResponse(
                        status_code=200,
                        content={
                            "status": "success",
                            "message": f"CSV processed successfully. Created {result['users_created']} users, skipped {result['users_skipped']} users.",
                            "users_created": result["users_created"],
                            "users_skipped": result["users_skipped"],
                            "errors": result.get("errors", []),
                            "created_users": result.get("created_users", []),
                            "skipped_users": result.get("skipped_users", []),
                        },
                    )
                else:
                    return JSONResponse(
                        status_code=400,
                        content={
                            "status": "error",
                            "message": result["error"],
                        },
                    )

            except Exception as csv_error:
                logger.error(f"Error processing CSV file: {str(csv_error)}")
                return JSONResponse(
                    status_code=500,
                    content={
                        "status": "error",
                        "message": f"Failed to process CSV file: {str(csv_error)}",
                    },
                )

        # Check if this is a ZIP file upload
        is_zip = body.get("zip", False)
        if is_zip:
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
                        "message": f"Upload with fileId {str(file_id)} not found",
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

            # Process ZIP file
            try:
                extracted_documents = []

                # Extract ZIP file
                with zipfile.ZipFile(file_path, "r") as zip_ref:
                    # Create a temporary directory for extraction
                    extract_dir = os.path.join(TUS_UPLOADS_DIR, f"extract_{file_id}")
                    os.makedirs(extract_dir, exist_ok=True)

                    # Extract all files
                    zip_ref.extractall(extract_dir)

                    # Process each extracted file
                    for root, dirs, files in os.walk(extract_dir):
                        for filename in files:
                            # Skip hidden files and directories
                            if filename.startswith(".") or filename.startswith(
                                "__MACOSX"
                            ):
                                continue

                            extracted_file_path = os.path.join(root, filename)

                            # Generate document ID
                            document_id = uuid.uuid4()

                            # Get file extension
                            _, ext = os.path.splitext(filename)
                            if not ext:
                                ext = ".bin"

                            # Create final file path
                            final_file_path = f"{document_id}{ext}"
                            final_full_path = os.path.join(
                                UPLOAD_FOLDER, final_file_path
                            )

                            # Copy file to final location
                            shutil.copy2(extracted_file_path, final_full_path)

                            # Get the best content type for this file
                            content_type = get_content_type(filename)

                            # Create document record
                            document = Documents(
                                id=document_id,
                                name=filename,
                                file_path=final_file_path,
                                mime_type=content_type,
                            )

                            session.add(document)
                            extracted_documents.append(
                                {
                                    "id": str(document_id),
                                    "name": filename,
                                    "mime_type": content_type,
                                }
                            )

                    # Clean up extraction directory
                    shutil.rmtree(extract_dir)

                session.commit()

                # Clean up the TUS upload directory
                try:
                    shutil.rmtree(upload_dir)
                    logger.info(f"Cleaned up TUS upload directory: {upload_dir}")
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to clean up TUS upload directory: {str(cleanup_error)}"
                    )

                # Automatically classify the documents if requested
                auto_classify = body.get("autoClassify", False)
                classification_result = None

                if auto_classify:
                    try:
                        # Call the classify agent directly
                        from app.services.agents.collection.classify import \
                            run_classify_agent

                        # Get document IDs for classification
                        document_ids = [UUID(doc["id"]) for doc in extracted_documents]
                        classification_result = await run_classify_agent(
                            document_ids,
                            test,
                            session,
                            profile_id,
                        )
                        logger.info(
                            f"Auto-classification completed: {classification_result}"
                        )

                    except Exception as classify_error:
                        logger.warning(
                            f"Auto-classification error: {str(classify_error)}"
                        )

                return JSONResponse(
                    status_code=200,
                    content={
                        "status": "success",
                        "message": f"ZIP file processed successfully. Extracted {len(extracted_documents)} documents.",
                        "extracted_count": len(extracted_documents),
                        "documents": extracted_documents,
                        "classification_result": classification_result,
                    },
                )

            except zipfile.BadZipFile:
                return JSONResponse(
                    status_code=400,
                    content={
                        "status": "error",
                        "message": "Invalid ZIP file format",
                    },
                )
            except Exception as zip_error:
                logger.error(f"Error processing ZIP file: {str(zip_error)}")
                return JSONResponse(
                    status_code=500,
                    content={
                        "status": "error",
                        "message": f"Failed to process ZIP file: {str(zip_error)}",
                    },
                )

        # Handle regular document uploads
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
                    "message": f"Upload with fileId {str(file_id)} not found",
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
        document_id = uuid.uuid4()

        # Create final file path
        final_file_path = f"{document_id}{ext}"
        final_full_path = os.path.join(UPLOAD_FOLDER, final_file_path)

        # Move the file to its final location
        shutil.copy2(file_path, final_full_path)

        # Get the best content type for this file
        content_type = get_content_type(filename, metadata.get("filetype"))
        
        # Create document record in database
        document = Documents(
            id=document_id,
            name=filename,
            file_path=final_file_path,
            mime_type=content_type,
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
                "document_id": str(document_id),
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


@router.post("/certificate")
async def generate_certificate(
    request: Request,
    session: Session = Depends(get_session),
) -> Response:
    """
    Generate a certificate PDF for a profile showing their cohort progress
    Returns the file directly as a download response
    """
    try:
        # Parse request body
        body = await request.json()
        profile_id = body.get("profileId")
        profile_name = body.get("profileName")
        cohort_data = body.get("cohortData", [])
        
        if not profile_id or not profile_name:
            raise HTTPException(status_code=400, detail="Missing profile information")
        
        # Generate PDF using reportlab
        try:
            import io

            from reportlab.lib import colors  # type: ignore
            from reportlab.lib.pagesizes import letter  # type: ignore
            from reportlab.lib.styles import ParagraphStyle  # type: ignore
            from reportlab.lib.styles import \
                getSampleStyleSheet  # type: ignore
            from reportlab.lib.units import inch  # type: ignore
            from reportlab.platypus import Paragraph  # type: ignore
            from reportlab.platypus import SimpleDocTemplate  # type: ignore
            from reportlab.platypus import Spacer, Table, TableStyle

            # Create PDF in memory
            buffer = io.BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=letter, 
                                  leftMargin=0.5*inch, rightMargin=0.5*inch,
                                  topMargin=0.5*inch, bottomMargin=0.5*inch)
            story = []
            
            # Create a frame with border for the content
            from reportlab.lib.units import inch
            from reportlab.platypus import Frame

            # Create a frame that will contain all content with a border
            content_frame = Frame(
                doc.leftMargin + 0.2*inch, doc.bottomMargin + 0.2*inch,
                doc.width - 0.4*inch, doc.height - 0.4*inch,
                leftPadding=0.1*inch,
                bottomPadding=0.1*inch,
                rightPadding=0.1*inch,
                topPadding=0.1*inch,
                showBoundary=1  # This creates the border
            )
            
            # Get styles
            styles = getSampleStyleSheet()
            
            # Create certificate border
            def create_border() -> Drawing:
                try:
                    # Create decorative border - smaller to fit page
                    border_drawing = Drawing(5*inch, 7*inch)
                    
                    # Outer border
                    outer_rect = Rect(0, 0, 5*inch, 7*inch, 
                                     strokeColor=colors.darkblue, 
                                     strokeWidth=3, 
                                     fillColor=None)
                    border_drawing.add(outer_rect)
                    
                    # Inner border
                    inner_rect = Rect(0.1*inch, 0.1*inch, 4.8*inch, 6.8*inch, 
                                     strokeColor=colors.darkblue, 
                                     strokeWidth=1, 
                                     fillColor=None)
                    border_drawing.add(inner_rect)
                    
                    # Corner decorations
                    corner_size = 0.2*inch
                    for x, y in [(0, 0), (5*inch-corner_size, 0), 
                                (0, 7*inch-corner_size), (5*inch-corner_size, 7*inch-corner_size)]:
                        corner = Rect(x, y, corner_size, corner_size, 
                                     strokeColor=colors.darkblue, 
                                     strokeWidth=2, 
                                     fillColor=colors.lightblue)
                        border_drawing.add(corner)
                    
                    return border_drawing
                except ImportError:
                    return None
            
            # Create custom styles
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                spaceAfter=30,
                alignment=1,  # Center
                textColor=colors.darkblue
            )
            
            name_style = ParagraphStyle(
                'NameStyle',
                parent=styles['Heading2'],
                fontSize=28,
                spaceAfter=20,
                alignment=1,  # Center
                textColor=colors.black
            )
            
            status_style = ParagraphStyle(
                'StatusStyle',
                parent=styles['Heading2'],
                fontSize=20,
                spaceAfter=30,
                alignment=1,  # Center
                fontWeight='bold'
            )
            
            header_style = ParagraphStyle(
                'HeaderStyle',
                parent=styles['Heading3'],
                fontSize=14,
                spaceAfter=10,
                textColor=colors.darkblue
            )
            
            # Add title
            story.append(Paragraph("Certificate of Completion", title_style))
            story.append(Spacer(1, 10))
            
            # Add profile name
            story.append(Paragraph(profile_name, name_style))
            story.append(Spacer(1, 30))
            
            # Calculate overall status
            total_cohorts = len(cohort_data)
            passed_cohorts = sum(1 for cohort in cohort_data if cohort.get("passed", False))
            all_passed = passed_cohorts == total_cohorts and total_cohorts > 0
            
            # Add status
            if all_passed:
                status_text = "COMPLETE"
                status_color = colors.green
            else:
                status_text = "INCOMPLETE"
                status_color = colors.red
            
            status_style.textColor = status_color
            story.append(Paragraph(status_text, status_style))
            story.append(Spacer(1, 30))
            
            # Add progress summary
            summary_text = f"Progress: {passed_cohorts} of {total_cohorts} cohorts completed"
            story.append(Paragraph(summary_text, styles['Normal']))
            story.append(Spacer(1, 20))
            
            # Add cohort details
            if cohort_data:
                story.append(Paragraph("Cohort Progress", header_style))
                
                # Create table data
                table_data = [["Cohort", "Simulation", "Score", "Status"]]
                
                for cohort in cohort_data:
                    cohort_name = cohort.get("name", "Unknown Cohort")
                    simulations = cohort.get("simulations", [])
                    
                    for sim in simulations:
                        sim_name = sim.get("name", "Unknown Simulation")
                        score = sim.get("score", 0)
                        passed = sim.get("passed", False)
                        
                        score_text = f"{score}%" if score > 0 else "No attempts"
                        status_text = "PASS" if passed else "FAIL" if score > 0 else "Not attempted"
                        
                        table_data.append([cohort_name, sim_name, score_text, status_text])
                
                # Create table with better column widths and text wrapping
                table = Table(table_data, colWidths=[1.8*inch, 2.5*inch, 1*inch, 1*inch])
                table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 11),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.lightblue),
                    ('GRID', (0, 0), (-1, -1), 1, colors.darkblue),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 9),
                    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('WORDWRAP', (0, 0), (-1, -1), True),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
                ]))
                
                story.append(table)
                story.append(Spacer(1, 30))
            
            # Build PDF with sophisticated border
            from reportlab.platypus import PageTemplate
            from reportlab.platypus.frames import Frame  # type: ignore

            # Create a custom page template with decorative border
            def certificate_page(canvas, doc): # type: ignore
                # Draw outer border
                canvas.setStrokeColor(colors.darkblue)
                canvas.setLineWidth(3)
                canvas.rect(doc.leftMargin + 0.1*inch, doc.bottomMargin + 0.1*inch, 
                          doc.width - 0.2*inch, doc.height - 0.2*inch)
                
                # Draw inner border
                canvas.setLineWidth(1)
                canvas.rect(doc.leftMargin + 0.2*inch, doc.bottomMargin + 0.2*inch, 
                          doc.width - 0.4*inch, doc.height - 0.4*inch)
                
                # Draw corner decorations
                canvas.setFillColor(colors.lightblue)
                corner_size = 0.15*inch
                for x, y in [(doc.leftMargin + 0.1*inch, doc.bottomMargin + doc.height - 0.25*inch),
                            (doc.leftMargin + doc.width - 0.25*inch, doc.bottomMargin + doc.height - 0.25*inch),
                            (doc.leftMargin + 0.1*inch, doc.bottomMargin + 0.1*inch),
                            (doc.leftMargin + doc.width - 0.25*inch, doc.bottomMargin + 0.1*inch)]:
                    canvas.rect(x, y, corner_size, corner_size, fill=1)
                
                # Add branding text in bottom left corner
                canvas.setFont("Helvetica", 10)
                canvas.setFillColor(colors.darkblue)
                branding_text = "GLOW | Purdue University"
                # Position in bottom left, inside the border but with some margin
                x_pos = doc.leftMargin + 0.3*inch
                y_pos = doc.bottomMargin + 0.3*inch
                canvas.drawString(x_pos, y_pos, branding_text)
            
            page_template = PageTemplate(id='certificate', frames=[content_frame], onPage=certificate_page)
            doc.addPageTemplates([page_template])
            doc.build(story)
            buffer.seek(0)
            original_pdf_bytes = buffer.getvalue()
            pdf_bytes_to_return = original_pdf_bytes

            # Try to convert to PDF/A for archival (best-effort).
            # PDF/A forbids encryption; this step aims for PDF/A-2b compliance using Ghostscript.
            try:
                def find_srgb_icc() -> str | None:
                    candidate_paths = [
                        "/usr/share/color/icc/ghostscript/srgb.icc",
                        "/usr/share/color/icc/srgb.icc",
                        "/usr/share/icc/colord/sRGB.icc",
                        "/usr/share/ghostscript/iccprofiles/srgb.icc",
                        "/usr/share/ghostscript/10.00.0/iccprofiles/srgb.icc",
                        "/usr/share/ghostscript/9.56.1/iccprofiles/srgb.icc",
                    ]
                    for path in candidate_paths:
                        if os.path.exists(path):
                            return path
                    return None

                srgb_icc = find_srgb_icc()

                with tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as in_file, \
                     tempfile.NamedTemporaryFile(suffix=".pdf", delete=True) as out_file:
                    in_file.write(original_pdf_bytes)
                    in_file.flush()

                    gs_cmd = [
                        "gs",
                        "-dBATCH",
                        "-dNOPAUSE",
                        "-sDEVICE=pdfwrite",
                        "-dPDFSETTINGS=/prepress",
                        "-sProcessColorModel=DeviceRGB",
                        "-sColorConversionStrategy=sRGB",
                        "-dUseCIEColor",
                        # PDF/A-2b (more permissive than 1b and widely supported)
                        "-dPDFA=2",
                        "-dPDFACompatibilityPolicy=1",
                        f"-sOutputFile={out_file.name}",
                    ]

                    # Include output ICC profile when available (required for strict PDF/A)
                    if srgb_icc:
                        gs_cmd.append(f"-sOutputICCProfile={srgb_icc}")

                    gs_cmd.append(in_file.name)

                    proc = subprocess.run(gs_cmd, capture_output=True, text=True)
                    if proc.returncode == 0 and os.path.exists(out_file.name) and os.path.getsize(out_file.name) > 0:
                        with open(out_file.name, "rb") as f_out:
                            pdf_bytes_to_return = f_out.read()
                    else:
                        logger.warning(
                            "Ghostscript PDF/A conversion failed; returning original PDF. stderr=%s", proc.stderr
                        )
            except FileNotFoundError:
                # Ghostscript not installed in this environment
                logger.info("Ghostscript not found; returning non-PDF/A PDF (original bytes)")
            except Exception as conv_err:
                logger.warning("PDF/A conversion error; returning original PDF: %s", str(conv_err))
            
            # Generate filename for download
            filename = f"certificate_{profile_name.replace(' ', '_')}_{uuid.uuid4().hex[:8]}.pdf"
            
            # Return PDF directly as file download
            return Response(
                content=pdf_bytes_to_return,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=\"{filename}\"",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                }
            )
            
        except ImportError:
            # Fallback if reportlab is not available
            logger.warning("ReportLab not available, using simple text generation")
            
            # Create simple text content as fallback
            text_content = []
            text_content.append("Certificate of Completion")
            text_content.append("=" * 30)
            text_content.append("")
            text_content.append(f"Name: {profile_name}")
            text_content.append("")
            
            # Calculate overall status
            total_cohorts = len(cohort_data)
            passed_cohorts = sum(1 for cohort in cohort_data if cohort.get("passed", False))
            all_passed = passed_cohorts == total_cohorts and total_cohorts > 0
            
            text_content.append(f"Status: {'COMPLETE' if all_passed else 'INCOMPLETE'}")
            text_content.append(f"Progress: {passed_cohorts} of {total_cohorts} cohorts completed")
            text_content.append("")
            
            text_content.append("Cohort Progress:")
            text_content.append("-" * 20)
            
            for cohort in cohort_data:
                cohort_name = cohort.get("name", "Unknown Cohort")
                simulations = cohort.get("simulations", [])
                
                text_content.append(f"\n{cohort_name}:")
                for sim in simulations:
                    sim_name = sim.get("name", "Unknown Simulation")
                    score = sim.get("score", 0)
                    passed = sim.get("passed", False)
                    
                    score_text = f"{score}%" if score > 0 else "No attempts"
                    status_text = "PASS" if passed else "FAIL" if score > 0 else "Not attempted"
                    
                    text_content.append(f"  - {sim_name}: {score_text} ({status_text})")
            
            text_content.append("")
            text_content.append("GLOW | Purdue University")
            
            # Generate filename for download
            filename = f"certificate_{profile_name.replace(' ', '_')}_{uuid.uuid4().hex[:8]}.txt"
            
            # Return text file directly as download
            return Response(
                content="\n".join(text_content),
                media_type="text/plain",
                headers={
                    "Content-Disposition": f"attachment; filename=\"{filename}\"",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                }
            )
            
    except Exception as e:
        logger.error(f"Error generating certificate: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": f"Failed to generate certificate: {str(e)}"},
        )


@router.delete("/id/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    session: Session = Depends(get_session),
) -> JSONResponse:
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
