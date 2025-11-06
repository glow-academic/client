"""Document upload finalize endpoint - v3 API following DHH principles."""

import json
import logging
import os
import shutil
import uuid
import zipfile
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.extensions import UPLOAD_FOLDER
from app.utils.http_cache import invalidate_tags
from app.utils.mime_utils import get_content_type
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Directory for storing tus uploads in progress
TUS_UPLOADS_DIR = os.path.join(UPLOAD_FOLDER, "tus_uploads")


# Inline request/response schemas
class UploadFinalizeRequest(BaseModel):
    """Request to finalize upload."""

    uploadId: str
    fileId: str
    zip: bool | None = False
    autoClassify: bool | None = False
    csv: bool | None = False
    test: bool | None = False
    profileId: str | None = None
    departmentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None


class UploadFinalizeResponse(BaseModel):
    """Response from finalize upload."""

    success: bool
    message: str
    status: str
    documentId: str | None = None
    documents: list[dict[str, str]] | None = None
    usersCreated: int | None = None
    usersSkipped: int | None = None
    errors: list[str] | None = None


router = APIRouter()


@router.post("/upload/finalize", response_model=UploadFinalizeResponse)
async def upload_finalize(
    request: UploadFinalizeRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UploadFinalizeResponse:
    """Finalize a document upload and process the file."""
    tags = ["documents"]  # From router tags
    
    try:
        # Validate department_ids is provided
        department_ids = request.departmentIds
        if not department_ids:
            return UploadFinalizeResponse(
                success=False,
                message="departmentIds is required - must be provided from frontend",
                status="error",
            )
        
        # Find the upload directory
        upload_dir = None
        for dir_name in os.listdir(TUS_UPLOADS_DIR):
            metadata_path = os.path.join(TUS_UPLOADS_DIR, dir_name, "metadata.json")
            if os.path.exists(metadata_path):
                with open(metadata_path) as f:
                    metadata = json.load(f)
                    if metadata.get("fileId") == request.fileId:
                        upload_dir = os.path.join(TUS_UPLOADS_DIR, dir_name)
                        break

        if not upload_dir:
            return UploadFinalizeResponse(
                success=False,
                message=f"Upload with fileId {request.fileId} not found",
                status="error",
            )

        # Get the uploaded file path
        file_path = os.path.join(upload_dir, "file")

        # Check if file exists and has content
        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            return UploadFinalizeResponse(
                success=False,
                message="Upload file is missing or empty",
                status="error",
            )

        # Handle CSV uploads
        if request.csv:
            from app.services.profile_service import ProfileService

            # Process CSV file to create profiles
            profile_service = ProfileService(conn)
            result = await profile_service.create_profiles_from_csv(file_path)

            # Clean up upload directory
            try:
                shutil.rmtree(upload_dir)
            except Exception as e:
                logger.warning(f"Failed to clean up upload directory: {str(e)}")

            if not result["success"]:
                return UploadFinalizeResponse(
                    success=False,
                    message=result.get("error", "Failed to process CSV file"),
                    status="error",
                )

            # Build success message
            message_parts = [f"Created {result['users_created']} users"]
            if result["users_skipped"] > 0:
                message_parts.append(
                    f"skipped {result['users_skipped']} existing users"
                )
            if result["errors"]:
                message_parts.append(f"{len(result['errors'])} errors encountered")

            result_data = UploadFinalizeResponse(
                success=True,
                message=", ".join(message_parts),
                status="complete",
                usersCreated=result.get("users_created", 0),
                usersSkipped=result.get("users_skipped", 0),
                errors=result.get("errors"),
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data

        # Handle ZIP file uploads
        if request.zip:
            extracted_documents = []

            with zipfile.ZipFile(file_path, "r") as zip_ref:
                extract_dir = os.path.join(
                    TUS_UPLOADS_DIR, f"extract_{request.fileId}"
                )
                os.makedirs(extract_dir, exist_ok=True)
                zip_ref.extractall(extract_dir)

                for root, dirs, files in os.walk(extract_dir):
                    for filename in files:
                        if filename.startswith(".") or filename.startswith("__MACOSX"):
                            continue

                        extracted_file_path = os.path.join(root, filename)
                        document_id = uuid.uuid4()
                        _, ext = os.path.splitext(filename)
                        if not ext:
                            ext = ".bin"

                        final_file_path = f"{document_id}{ext}"
                        final_full_path = os.path.join(UPLOAD_FOLDER, final_file_path)
                        shutil.copy2(extracted_file_path, final_full_path)

                        content_type = get_content_type(filename)

                        # Insert document into database
                        sql = load_sql("sql/v3/documents/insert_document.sql")
                        await conn.execute(
                            sql,
                            document_id,
                            filename,
                            final_file_path,
                            content_type,
                        )

                        # Insert document-department relationships
                        if department_ids:
                            dept_sql = load_sql("sql/v3/documents/insert_document_department.sql")
                            await conn.execute(
                                dept_sql,
                                document_id,
                                department_ids,
                            )

                        extracted_documents.append(
                            {
                                "id": str(document_id),
                                "name": filename,
                                "mime_type": content_type,
                            }
                        )

                # Clean up
                try:
                    shutil.rmtree(extract_dir)
                    shutil.rmtree(upload_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up directories: {str(e)}")

            result_data = UploadFinalizeResponse(
                success=True,
                message=f"ZIP file processed successfully. Extracted {len(extracted_documents)} documents.",
                status="success",
                documents=extracted_documents,
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data

        # Handle regular document upload
        document_id = uuid.uuid4()

        metadata_path = os.path.join(upload_dir, "metadata.json")
        with open(metadata_path) as f:
            metadata = json.load(f)

        filename = metadata.get("filename", "unknown")
        _, ext = os.path.splitext(filename)
        if not ext:
            ext = ".bin"

        final_file_path = f"{document_id}{ext}"
        final_full_path = os.path.join(UPLOAD_FOLDER, final_file_path)
        shutil.copy2(file_path, final_full_path)

        content_type = metadata.get("filetype") or get_content_type(filename)

        # Insert document into database
        sql = load_sql("sql/v3/documents/insert_document.sql")
        await conn.execute(
            sql,
            document_id,
            filename,
            final_file_path,
            content_type,
        )

        # Insert document-department relationships
        if department_ids:
            dept_sql = load_sql("sql/v3/documents/insert_document_department.sql")
            await conn.execute(
                dept_sql,
                document_id,
                department_ids,
            )

        # Insert parameter item relationships if provided
        if request.parameterItemIds:
            param_sql = load_sql("sql/v3/documents/insert_document_parameter_item.sql")
            for param_item_id in request.parameterItemIds:
                await conn.execute(
                    param_sql,
                    document_id,
                    uuid.UUID(param_item_id),
                )

        # Clean up
        try:
            shutil.rmtree(upload_dir)
        except Exception as e:
            logger.warning(f"Failed to clean up upload directory: {str(e)}")

        # Auto-classify if requested
        if request.autoClassify:
            try:
                logger.info(
                    f"Auto-classification requested for document {document_id}"
                )
            except Exception as e:
                logger.error(f"Auto-classification failed: {str(e)}")

        result_data = UploadFinalizeResponse(
            success=True,
            message="Document uploaded successfully",
            status="success",
            documentId=str(document_id),
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data

    except Exception as e:
        logger.error(f"Error finalizing upload: {str(e)}")
        return UploadFinalizeResponse(
            success=False,
            message=f"Failed to finalize upload: {str(e)}",
            status="error",
        )

