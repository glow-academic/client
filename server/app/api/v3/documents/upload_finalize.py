"""Document upload finalize endpoint - v3 API following DHH principles."""

import json
import os
import shutil
import uuid
import zipfile
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from app.main import UPLOAD_FOLDER, get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.mime.get_content_type import get_content_type
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

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
            from app.utils.csv.parse_csv_file import parse_csv_file

            logger.info(f"Processing CSV upload: fileId={request.fileId}")

            # Parse the CSV file
            parse_result = parse_csv_file(file_path)

            if not parse_result["success"]:
                # Clean up upload directory
                try:
                    shutil.rmtree(upload_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up upload directory: {str(e)}")

                return UploadFinalizeResponse(
                    success=False,
                    message=parse_result.get("error", "Failed to parse CSV file"),
                    status="error",
                    errors=parse_result.get("errors", []),
                )

            users_data = parse_result["users"]
            errors = parse_result["errors"].copy()
            users_created = []
            users_skipped = []

            # Load consolidated SQL query (check + insert in one query)
            insert_profile_sql = load_sql(
                "sql/v3/profile/insert_profile_if_not_exists.sql"
            )

            # Process each user within a transaction
            try:
                async with conn.transaction():
                    for user in users_data:
                        try:
                            name = user["name"]
                            username = user["username"]
                            row_num = user["row_num"]

                            # Insert profile if not exists (single query with ON CONFLICT)
                            user_id = str(uuid.uuid4())
                            result = await conn.fetchrow(
                                insert_profile_sql,
                                user_id,
                                name,  # first_name (using full name as first_name)
                                username,  # email
                                "ta",  # role
                                False,  # viewed_intro
                            )

                            if result:
                                # Profile was inserted
                                users_created.append(
                                    {"name": name, "username": username}
                                )
                            else:
                                # Profile already exists (ON CONFLICT DO NOTHING)
                                users_skipped.append(
                                    {
                                        "username": username,
                                        "reason": "User already exists",
                                    }
                                )

                        except Exception as e:
                            errors.append(f"Row {row_num}: {str(e)}")
                            continue

                # Clean up upload directory
                try:
                    shutil.rmtree(upload_dir)
                except Exception as e:
                    logger.warning(f"Failed to clean up upload directory: {str(e)}")

                # Build success message
                message_parts = [f"Created {len(users_created)} users"]
                if len(users_skipped) > 0:
                    message_parts.append(f"skipped {len(users_skipped)} existing users")
                if errors:
                    message_parts.append(f"{len(errors)} errors encountered")

                logger.info(
                    f"CSV processing complete: created={len(users_created)}, "
                    f"skipped={len(users_skipped)}, errors={len(errors)}"
                )

                result_data = UploadFinalizeResponse(
                    success=True,
                    message=", ".join(message_parts),
                    status="complete",
                    usersCreated=len(users_created),
                    usersSkipped=len(users_skipped),
                    errors=errors if errors else None,
                )

                # Invalidate cache after mutation
                await invalidate_tags(tags)
                response.headers["X-Invalidate-Tags"] = ",".join(tags)

                return result_data

            except Exception as e:
                logger.error(f"Database error processing CSV: {str(e)}")

                # Clean up upload directory
                try:
                    shutil.rmtree(upload_dir)
                except Exception as cleanup_error:
                    logger.warning(
                        f"Failed to clean up upload directory: {str(cleanup_error)}"
                    )

                return UploadFinalizeResponse(
                    success=False,
                    message=f"Database error: {str(e)}",
                    status="error",
                    errors=errors,
                )

        # Handle ZIP file uploads
        if request.zip:
            extracted_documents = []

            with zipfile.ZipFile(file_path, "r") as zip_ref:
                extract_dir = os.path.join(TUS_UPLOADS_DIR, f"extract_{request.fileId}")
                os.makedirs(extract_dir, exist_ok=True)
                zip_ref.extractall(extract_dir)

                for root, _dirs, files in os.walk(extract_dir):
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

                        # Insert document with department links in single query
                        dept_uuids = (
                            [uuid.UUID(d) for d in department_ids]
                            if department_ids
                            else []
                        )
                        sql = load_sql("sql/v3/documents/insert_document_complete.sql")
                        await conn.execute(
                            sql,
                            document_id,
                            filename,
                            final_file_path,
                            content_type,
                            dept_uuids,
                            [],  # parameter_item_ids (empty for ZIP uploads)
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

        # Insert document with department and parameter item links (single query)
        import uuid as uuid_lib

        param_item_uuids = [uuid_lib.UUID(p) for p in (request.parameterItemIds or [])]
        dept_uuids = (
            [uuid_lib.UUID(d) for d in department_ids] if department_ids else []
        )

        sql = load_sql("sql/v3/documents/insert_document_complete.sql")
        await conn.execute(
            sql,
            document_id,
            filename,
            final_file_path,
            content_type,
            dept_uuids,
            param_item_uuids,
        )

        # Clean up
        try:
            shutil.rmtree(upload_dir)
        except Exception as e:
            logger.warning(f"Failed to clean up upload directory: {str(e)}")

        # Auto-classify if requested
        if request.autoClassify:
            try:
                logger.info(f"Auto-classification requested for document {document_id}")
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
